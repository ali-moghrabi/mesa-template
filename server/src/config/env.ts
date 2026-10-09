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
