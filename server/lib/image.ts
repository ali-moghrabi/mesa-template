import sharp from 'sharp';

sharp.cache(false);

export const ACCEPTED_IMAGE_FORMATS = [
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'tiff',
  'heif',
] as const;

export interface OptimizeOptions {
  maxSide: number;
  quality: number;
}

export const MENU_IMAGE: OptimizeOptions = { maxSide: 1600, quality: 80 };

export interface OptimizedImage {
  buffer: Buffer;
  format: 'webp';
  width: number;
  height: number;
  bytes: number;
  blurDataURL: string;
}

export class ImageError extends Error {
  constructor(
    message: string,
    readonly reason: 'unreadable' | 'format' | 'too-large',
  ) {
    super(message);
  }
}

const MAX_INPUT_PIXELS = 50_000_000;

export async function optimizeImage(
  input: Buffer,
  options: OptimizeOptions = MENU_IMAGE,
): Promise<OptimizedImage> {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: false }).metadata();
  } catch {
    throw new ImageError(
      'This file is not an image we can read.',
      'unreadable',
    );
  }

  if (
    !metadata.format ||
    !(ACCEPTED_IMAGE_FORMATS as readonly string[]).includes(metadata.format)
  ) {
    throw new ImageError('Use a JPG, PNG, WebP or AVIF photo.', 'format');
  }
  if ((metadata.width ?? 0) * (metadata.height ?? 0) > MAX_INPUT_PIXELS) {
    throw new ImageError(
      'This photo is too large. Use one under 50 megapixels.',
      'too-large',
    );
  }

  const longest = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  const shrinking = longest > options.maxSide;

  let pipeline = sharp(input, {
    autoOrient: true,
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
    animated: false,
  })
    .resize({
      width: options.maxSide,
      height: options.maxSide,
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
    })
    .toColourspace('srgb');

  if (shrinking) pipeline = pipeline.sharpen({ sigma: 0.5 });

  let result: { data: Buffer; info: sharp.OutputInfo };
  try {
    result = await pipeline
      .webp({
        quality: options.quality,
        alphaQuality: 90,
        effort: 6,
        smartSubsample: true,
        smartDeblock: true,
        preset: 'photo',
      })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ImageError(
      'This photo looks damaged. Try exporting it again.',
      'unreadable',
    );
  }

  const tiny = await sharp(result.data)
    .resize(16, 16, { fit: 'inside' })
    .webp({ quality: 40, effort: 6 })
    .toBuffer();

  return {
    buffer: result.data,
    format: 'webp',
    width: result.info.width,
    height: result.info.height,
    bytes: result.info.size,
    blurDataURL: `data:image/webp;base64,${tiny.toString('base64')}`,
  };
}
