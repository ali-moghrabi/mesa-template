import type { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env';

export type Brand = {
  name: string;
  color: string;
  logoUrl?: string;
  address?: string;
  webUrl: string;
  timezone: string;
};

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
};

type Config = ConfigService<Env, true>;

const read = (config: Config, key: keyof Env): string | undefined => {
  const value: unknown = config.get(key, { infer: true });
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

export function smtpSettings(config: Config): SmtpSettings | null {
  const host = read(config, 'SMTP_HOST');
  if (!host) return null;
  const port = Number(read(config, 'SMTP_PORT') ?? 587);
  const user = read(config, 'SMTP_USER');
  return {
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: read(config, 'SMTP_PASS') ?? '' } : undefined,
  };
}

export function brandSettings(config: Config): Brand {
  const name = read(config, 'BRAND_NAME') ?? 'Our restaurant';
  const color = read(config, 'BRAND_COLOR') ?? '';
  return {
    name,
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#B4532A',
    logoUrl: read(config, 'BRAND_LOGO_URL'),
    address: read(config, 'BRAND_ADDRESS'),
    webUrl: (read(config, 'WEB_URL') ?? 'http://localhost:3000').replace(
      /\/+$/,
      '',
    ),
    timezone: read(config, 'BRAND_TIMEZONE') ?? 'UTC',
  };
}

export const mailFrom = (config: Config) =>
  read(config, 'MAIL_FROM') ??
  `${brandSettings(config).name} <no-reply@localhost>`;
