import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z
    .string()
    .refine(
      (v) => /^mongodb(\+srv)?:\/\//.test(v),
      'Must be a MongoDB URI (mongodb:// or mongodb+srv://)',
    ),
  CLIENT_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECRET: z.string().min(32, 'Use at least 32 random characters'),
  JWT_ACCESS_SECRET: z.string().min(32, 'Use at least 32 random characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'Use at least 32 random characters'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().min(1),
  S3_KEY_PREFIX: z.string().optional(),
  MEDIA_BASE_URL: z.url(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  WEB_URL: z.string().optional(),
  BRAND_NAME: z.string().optional(),
  BRAND_COLOR: z.string().optional(),
  BRAND_TIMEZONE: z.string().optional(),
  BRAND_LOGO_URL: z.string().optional(),
  BRAND_ADDRESS: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  ORDER_SIGNING_SECRET: z.string().optional(),
  SITE_CONFIG_PATH: z.string().optional(),
  ONBOARDING_NOTIFY_EMAIL: z.email().optional(),
  ONBOARDING_WHATSAPP_PHONE: z.string().optional(),
  CALLMEBOT_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
