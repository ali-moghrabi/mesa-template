import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { ImageError, MENU_IMAGE, optimizeImage } from 'lib/image';
import { mediaUrl, normalizePrefix } from 'lib/media-url';

export interface UploadedImage {
  key: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  blurDataURL: string;
}

export interface StoredImage {
  key: string;
  blurDataURL?: string;
}

const TEMP_MENU_KEY =
  /^tmp\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;
export const isTempMenuKey = (key: string) => TEMP_MENU_KEY.test(key);

const CACHE_FOREVER = 'public, max-age=31536000, immutable';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.prefix = normalizePrefix(config.get<string>('S3_KEY_PREFIX'));

    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
    this.s3 = new S3Client({
      region: config.getOrThrow<string>('AWS_REGION'),
      ...(accessKeyId &&
        secretAccessKey && { credentials: { accessKeyId, secretAccessKey } }),
    });
  }

  async uploadMenuImage(file: Buffer): Promise<UploadedImage> {
    const image = await this.optimize(file);
    const key = `tmp/${randomUUID()}.webp`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(key),
        Body: image.buffer,
        ContentType: 'image/webp',
        CacheControl: CACHE_FOREVER,
        Metadata: {
          width: String(image.width),
          height: String(image.height),
          blur: image.blurDataURL,
        },
      }),
    );

    return {
      key,
      url: mediaUrl(key)!,
      width: image.width,
      height: image.height,
      bytes: image.bytes,
      blurDataURL: image.blurDataURL,
    };
  }

  async keepMenuImage(tempKey: string): Promise<StoredImage> {
    const match = TEMP_MENU_KEY.exec(tempKey);
    if (!match)
      throw imageFieldError(
        'This photo was not uploaded here. Upload it again.',
      );

    const finalKey = `menu/${match[1]}.webp`;
    let blur: string | undefined;
    try {
      const head = await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.fullKey(tempKey),
        }),
      );
      blur = head.Metadata?.blur;
    } catch (error) {
      if (isNotFound(error))
        throw imageFieldError('The photo upload expired. Upload it again.');
      throw error;
    }

    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: encodeCopySource(this.bucket, this.fullKey(tempKey)),
        Key: this.fullKey(finalKey),
        MetadataDirective: 'COPY',
      }),
    );

    return {
      key: finalKey,
      blurDataURL: blur?.startsWith('data:image/webp;base64,')
        ? blur
        : undefined,
    };
  }

  async deleteQuietly(key: string | undefined): Promise<void> {
    if (!key || /^https?:/i.test(key)) return;
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.fullKey(key),
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Could not delete ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteManyQuietly(
    keys: (string | undefined | null)[],
  ): Promise<number> {
    const ours = [
      ...new Set(
        keys.filter(
          (k): k is string =>
            !!k && (k.startsWith('menu/') || k.startsWith('tmp/')),
        ),
      ),
    ];
    let deleted = 0;
    for (let i = 0; i < ours.length; i += 1000) {
      const chunk = ours.slice(i, i + 1000);
      try {
        const result = await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: chunk.map((key) => ({ Key: this.fullKey(key) })),
              Quiet: true,
            },
          }),
        );
        for (const error of result.Errors ?? [])
          this.logger.warn(`Could not delete ${error.Key}: ${error.Message}`);
        deleted += chunk.length - (result.Errors?.length ?? 0);
      } catch (error) {
        this.logger.warn(
          `Could not delete ${chunk.length} photos: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return deleted;
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private async optimize(file: Buffer) {
    try {
      return await optimizeImage(file, MENU_IMAGE);
    } catch (error) {
      if (error instanceof ImageError) {
        if (error.reason === 'format')
          throw new UnsupportedMediaTypeException(error.message);
        if (error.reason === 'too-large')
          throw new PayloadTooLargeException(error.message);
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }
  }
}

function imageFieldError(message: string) {
  return new BadRequestException({
    statusCode: 400,
    message,
    errors: { image: message },
  });
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.name === 'NotFound' ||
      error.name === 'NoSuchKey' ||
      error.$metadata.httpStatusCode === 404)
  );
}

function encodeCopySource(bucket: string, key: string): string {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
