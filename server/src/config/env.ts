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
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  INTERNAL_PROXY_SECRET: z
    .string()
    .min(32, 'Use at least 32 random characters')
    .optional(),
  SHOW_CLIENT_IP: z.enum(['true', 'false']).optional(),
  MFA_ENCRYPTION_KEY: z.string().min(32, 'Use at least 32 random characters'),
  MFA_REQUIRED_ROLES: z.string().optional(),
  MFA_ISSUER: z.string().max(40).optional(),
  PASSWORD_BREACH_CHECK: z.enum(['on', 'off']).optional(),
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
  // Card payments through Tap (sk_test_… / sk_live_…). Empty: card payments are off.
  TAP_SECRET_KEY: z.string().optional(),
  TAP_PUBLIC_KEY: z.string().optional(),
  TAP_MERCHANT_ID: z.string().optional(),
  API_PUBLIC_URL: z.string().optional(),
  ORDER_SIGNING_SECRET: z.string().optional(),
  SITE_CONFIG_PATH: z.string().optional(),
  ONBOARDING_ENABLED: z.enum(['true', 'false']).optional(),
  ONBOARDING_NOTIFY_EMAIL: z.email().optional(),
  ONBOARDING_WHATSAPP_PHONE: z.string().optional(),
  CALLMEBOT_API_KEY: z.string().optional(),
  SITES_PATH: z.string().optional(),
  HQ_ONBOARDING_URL: z.string().optional(),
  HQ_ONBOARDING_SECRET: z.string().optional(),
  ONBOARDING_WHATSAPP_RECIPIENTS: z.string().optional(),
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
  const env = result.data;
  if (env.NODE_ENV === 'production') {
    if (env.MFA_REQUIRED_ROLES?.trim().toLowerCase() === 'none')
      console.warn(
        '[env] MFA_REQUIRED_ROLES=none: the admin panel opens without two-step sign-in. Only use this for a public demo.',
      );
    if (env.ORDER_SIGNING_SECRET && env.ORDER_SIGNING_SECRET.length < 32)
      console.warn(
        '[env] ORDER_SIGNING_SECRET is shorter than 32 characters: use a long random value.',
      );
    if (!env.INTERNAL_PROXY_SECRET)
      console.warn(
        '[env] INTERNAL_PROXY_SECRET is not set: visitors may share one rate limit (see the setup notes).',
      );
  }
  const secrets = [
    env.JWT_ACCESS_SECRET,
    env.JWT_REFRESH_SECRET,
    env.COOKIE_SECRET,
    env.MFA_ENCRYPTION_KEY,
  ];
  if (new Set(secrets).size !== secrets.length)
    throw new Error(
      'Invalid environment variables:\n  - JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, COOKIE_SECRET and MFA_ENCRYPTION_KEY must all be different',
    );
  return env;
}
