import { createHash, timingSafeEqual } from 'node:crypto';

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const REFRESH_GRACE_MS = 10_000;

export function isGraceReplay(
  session: { previousTokenHash?: string | null; rotatedAt?: Date | null },
  presentedHash: string,
  now: Date = new Date(),
): boolean {
  if (!session.previousTokenHash || !session.rotatedAt) return false;
  return (
    safeEqual(session.previousTokenHash, presentedHash) &&
    now.getTime() - session.rotatedAt.getTime() <= REFRESH_GRACE_MS
  );
}
