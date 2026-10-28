import type { NextFunction, Request, Response } from 'express';
import {
  ACCESS_TOKEN_NAME,
  REFRESH_TOKEN_NAME,
} from 'lib/constants/authConstants';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const hasAuthCookie = (req: Request) => {
  const header = req.headers.cookie ?? '';
  return (
    header.includes(`${ACCESS_TOKEN_NAME}=`) ||
    header.includes(`${REFRESH_TOKEN_NAME}=`)
  );
};

export function originGuard(allowedOrigins: ReadonlySet<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method) || !hasAuthCookie(req)) return next();

    const origin = req.headers.origin?.replace(/\/+$/, '');
    const fetchSite = req.headers['sec-fetch-site'];
    const allowed = origin
      ? allowedOrigins.has(origin)
      : fetchSite !== 'cross-site';

    if (allowed) return next();
    res.status(403).json({
      statusCode: 403,
      message: 'This request came from a site that is not allowed.',
    });
  };
}
