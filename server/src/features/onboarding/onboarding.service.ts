import { createHmac, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { optimizeImage } from 'lib/image';
import { mediaUrl, normalizePrefix } from 'lib/media-url';
import { slugify } from 'lib/slug';
import { MailService } from 'src/features/mail/mail.service';
import {
  onboardingClientEmail,
  onboardingTeamEmail,
  type OnboardingFile,
} from 'src/features/mail/templates/onboarding';
import { onboardingSchema, type OnboardingAnswers } from './onboarding.schema';

export type OnboardingUploads = {
  logo?: Express.Multer.File[];
  photos?: Express.Multer.File[];
  menu?: Express.Multer.File[];
};

const MESA_BRAND = {
  name: 'MESA',
  color: '#B4532A',
  webUrl: 'https://www.mesa-template.store',
  timezone: 'Asia/Beirut',
};

const LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};
const MENU_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly s3: S3Client | null;
  private readonly bucket?: string;
  private readonly prefix: string;

  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {
    this.bucket = config.get<string>('S3_BUCKET') || undefined;
    this.prefix = normalizePrefix(config.get<string>('S3_KEY_PREFIX'));
    const region = config.get<string>('AWS_REGION');
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
    this.s3 =
      this.bucket && region
        ? new S3Client({
            region,
            ...(accessKeyId &&
              secretAccessKey && {
                credentials: { accessKeyId, secretAccessKey },
              }),
          })
        : null;
  }

  async submit(
    body: { data?: string; config?: string },
    uploads: OnboardingUploads,
  ): Promise<{ id: string }> {
    const answers = this.parseAnswers(body.data);
    const configDraft = this.parseConfig(body.config);
    const id = `${slugify(answers.restaurant.name, 40) || 'restaurant'}-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString('hex')}`;

    const { links, attachments } = await this.storeFiles(id, uploads);
    attachments.unshift(
      {
        filename: `${id}-config.json`,
        content: configDraft,
        contentType: 'application/json',
      },
      {
        filename: `${id}-answers.json`,
        content: JSON.stringify(answers, null, 2),
        contentType: 'application/json',
      },
    );

    const notify =
      this.config.get<string>('ONBOARDING_NOTIFY_EMAIL') ||
      this.config.get<string>('MAIL_FROM_ADDRESS');
    if (!notify)
      this.logger.error(
        'ONBOARDING_NOTIFY_EMAIL is not set: the onboarding email has nowhere to go',
      );
    else
      await this.mail.send(
        notify,
        onboardingTeamEmail(MESA_BRAND, { id, answers, files: links }),
        {
          replyTo: answers.contact.email,
          attachments,
        },
      );

    await Promise.allSettled([
      this.notifyWhatsApp(id, answers, links.length),
      this.mail.send(
        answers.contact.email,
        onboardingClientEmail(MESA_BRAND, { answers }),
        notify ? { replyTo: notify } : {},
      ),
    ]).then((results) =>
      results.forEach(
        (r) =>
          r.status === 'rejected' &&
          this.logger.warn(`Onboarding ${id}: ${String(r.reason)}`),
      ),
    );

    void this.forwardToHq(id, answers, configDraft, links).catch((error) =>
      this.logger.error(
        `Onboarding ${id}: not sent to HQ (${String(error)}). It's still in the email.`,
      ),
    );

    this.logger.log(`Onboarding received: ${id}`);
    return { id };
  }

  private parseAnswers(raw: string | undefined): OnboardingAnswers {
    let json: unknown;
    try {
      json = JSON.parse(raw ?? '');
    } catch {
      throw new BadRequestException(
        'The form data is missing. Please reload the page and try again.',
      );
    }
    const parsed = onboardingSchema.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadRequestException(
        `${issue.path.join(' › ')}: ${issue.message}`,
      );
    }
    return parsed.data;
  }

  private parseConfig(raw: string | undefined): string {
    if (!raw || raw.length > 400_000) return '{}';
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return '{}';
    }
  }

  private async storeFiles(id: string, uploads: OnboardingUploads) {
    const links: OnboardingFile[] = [];
    const attachments: {
      filename: string;
      content: Buffer | string;
      contentType: string;
    }[] = [];

    const keep = async (
      kind: OnboardingFile['kind'],
      name: string,
      buffer: Buffer,
      contentType: string,
    ) => {
      if (this.s3 && this.bucket) {
        const key = `onboarding/${id}/${name}`;
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: `${this.prefix}${key}`,
            Body: buffer,
            ContentType: contentType,
          }),
        );
        links.push({
          kind,
          name,
          url: mediaUrl(key) ?? key,
          bytes: buffer.length,
        });
      } else {
        attachments.push({ filename: name, content: buffer, contentType });
        links.push({ kind, name, bytes: buffer.length });
      }
    };

    const logo = uploads.logo?.[0];
    if (logo) {
      const ext = LOGO_TYPES[logo.mimetype];
      if (!ext)
        throw new BadRequestException(
          'Upload the logo as PNG, JPG, WebP or SVG.',
        );
      await keep('logo', `logo.${ext}`, logo.buffer, logo.mimetype);
    }

    for (const [i, photo] of (uploads.photos ?? []).entries()) {
      const image = await optimizeImage(photo.buffer).catch(() => null);
      if (!image) continue;
      await keep(
        'photo',
        `photo-${String(i + 1).padStart(2, '0')}.webp`,
        image.buffer,
        'image/webp',
      );
    }

    for (const [i, file] of (uploads.menu ?? []).entries()) {
      const ext = MENU_TYPES[file.mimetype];
      if (!ext) continue;
      await keep('menu', `menu-${i + 1}.${ext}`, file.buffer, file.mimetype);
    }

    return { links, attachments };
  }

  private async notifyWhatsApp(
    id: string,
    a: OnboardingAnswers,
    fileCount: number,
  ) {
    const phone = this.config.get<string>('ONBOARDING_WHATSAPP_PHONE');
    const apiKey = this.config.get<string>('CALLMEBOT_API_KEY');
    if (!phone || !apiKey) return;

    const services = [
      a.services.reservations && 'reservations',
      a.services.delivery && 'delivery',
      a.services.pickup && 'pickup',
      a.services.whatsappOrdering && 'WhatsApp orders',
    ].filter(Boolean);
    const text = [
      `🍽️ *New MESA client:* ${a.restaurant.name}`,
      `${a.restaurant.cuisine.join(', ')} · ${a.contact.city}, ${a.contact.country}`,
      `👤 ${a.person.name}${a.person.role ? ` (${a.person.role})` : ''} · ${a.person.phone}`,
      `📧 ${a.contact.email}`,
      `🎨 ${a.brand.primaryColor} · ${a.brand.mode} · plan: ${a.extras.plan}`,
      `⚙️ ${services.join(', ') || 'website only'}`,
      `📎 ${fileCount} file${fileCount === 1 ? '' : 's'} · ref ${id}`,
      'Full details and config.json are in your email.',
    ].join('\n');

    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`CallMeBot answered ${response.status}`);
  }

  private async forwardToHq(
    id: string,
    answers: OnboardingAnswers,
    config: string,
    files: OnboardingFile[],
  ) {
    const url = this.config.get<string>('HQ_ONBOARDING_URL');
    const secret = this.config.get<string>('HQ_ONBOARDING_SECRET');
    if (!url || !secret) return;

    const body = JSON.stringify({
      id,
      submittedAt: new Date().toISOString(),
      answers,
      config,
      files,
    });

    for (let attempt = 1; ; attempt++) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = `sha256=${createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex')}`;
      let retry: boolean;
      let problem: string;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mesa-timestamp': timestamp,
            'x-mesa-signature': signature,
          },
          body,
          signal: AbortSignal.timeout(15_000),
        });
        if (response.ok) {
          this.logger.log(`Onboarding ${id}: sent to HQ`);
          return;
        }
        retry = response.status >= 500;
        problem = `HQ answered ${response.status}: ${(await response.text()).slice(0, 200)}`;
      } catch (error) {
        retry = true;
        problem = String(error);
      }
      if (!retry || attempt >= 3) throw new Error(problem);
      await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
    }
  }
}
