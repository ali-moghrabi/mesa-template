import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';

export const PROXY_KEY_HEADER = 'x-mesa-proxy-key';
export const CLIENT_IP_HEADER = 'x-mesa-client-ip';

const digest = (value: string) => createHash('sha256').update(value).digest();

export function sameSecret(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

export function fromTrustedProxy(req: Request): boolean {
  const secret = process.env.INTERNAL_PROXY_SECRET;
  const key = req.headers[PROXY_KEY_HEADER];
  return !!secret && typeof key === 'string' && sameSecret(key, secret);
}

export function clientIp(req: Request): string | undefined {
  if (fromTrustedProxy(req)) {
    const forwarded = req.headers[CLIENT_IP_HEADER];
    const ip = typeof forwarded === 'string' ? forwarded.trim() : '';
    if (isIP(ip)) return ip;
  }
  return req.ip;
}
