import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
const BCRYPT_MAX_BYTES = 72;

const logger = new Logger('PasswordPolicy');

type About = {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
};

export async function passwordProblem(
  password: string,
  about: About = {},
): Promise<string | null> {
  if (password.length < PASSWORD_MIN)
    return `Use at least ${PASSWORD_MIN} characters`;
  if (
    password.length > PASSWORD_MAX ||
    Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES
  )
    return 'That password is too long. Use up to 72 characters.';
  if (/^(.)\1+$/.test(password))
    return 'Don’t use the same character over and over';

  const lower = password.toLowerCase();
  const personal = [
    about.email,
    about.email?.split('@')[0],
    about.username,
    about.firstName && about.lastName
      ? `${about.firstName}${about.lastName}`
      : undefined,
  ]
    .map((v) => v?.trim().toLowerCase())
    .filter((v): v is string => !!v && v.length >= 4);
  if (personal.some((v) => lower.includes(v)))
    return 'Don’t use your name, username or email in your password';

  if (await isBreached(password))
    return 'This password has appeared in a data breach. Choose a different one.';
  return null;
}

async function isBreached(password: string): Promise<boolean> {
  if (process.env.PASSWORD_BREACH_CHECK === 'off') return false;
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'MESA-API' },
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    return body.split('\n').some((line) => {
      const [hash, count] = line.trim().split(':');
      return hash === suffix && Number(count) > 0;
    });
  } catch (error) {
    logger.warn(`Breach check skipped: ${(error as Error).message}`);
    return false;
  }
}
