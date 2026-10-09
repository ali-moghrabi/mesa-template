import type { NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/constants/constants";

const TIMEOUT_MS = 4000;

const REPLAY_MS = 60_000;

function baseUrl(): string {
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!url)
    throw new Error(
      "Set API_URL or NEXT_PUBLIC_API_URL (e.g. http://localhost:4000/api/v1)",
    );
  return url.replace(/\/+$/, "");
}

export type ClientMeta = { ip?: string; userAgent?: string };

export function clientMeta(request: NextRequest): ClientMeta {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return {
    ip: forwarded || request.headers.get("x-real-ip") || undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}

function metaHeaders(meta: ClientMeta): Record<string, string> {
  const headers: Record<string, string> = {};
  if (meta.ip) headers["X-Forwarded-For"] = meta.ip;
  if (meta.userAgent) headers["User-Agent"] = meta.userAgent;
  return headers;
}

export type RenewResult =
  | { status: "ok"; setCookies: string[] }
  | { status: "rejected"; setCookies: string[] }
  | { status: "unavailable" };

async function callRefresh(
  refreshToken: string,
  meta: ClientMeta,
): Promise<RenewResult> {
  try {
    const response = await fetch(`${baseUrl()}/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}`,
        ...metaHeaders(meta),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const setCookies = response.headers.getSetCookie();
    if (response.ok) return { status: "ok", setCookies };
    if (response.status === 401) return { status: "rejected", setCookies };
    return { status: "unavailable" };
  } catch (error) {
    console.error("[auth] refresh request failed:", error);
    return { status: "unavailable" };
  }
}

const recent = new Map<string, Promise<RenewResult>>();

export function renewSession(
  refreshToken: string,
  meta: ClientMeta,
): Promise<RenewResult> {
  const known = recent.get(refreshToken);
  if (known) return known;

  const call = callRefresh(refreshToken, meta);
  recent.set(refreshToken, call);
  void call.then((result) => {
    if (result.status !== "ok") {
      recent.delete(refreshToken);
      return;
    }
    const timer = setTimeout(() => recent.delete(refreshToken), REPLAY_MS);
    (timer as { unref?: () => void }).unref?.();
  });
  return call;
}

export type UserResult =
  | { status: "ok"; user: IUser }
  | { status: "unauthorized" }
  | { status: "unavailable" };

export async function fetchUser(
  accessToken: string,
  meta: ClientMeta = {},
): Promise<UserResult> {
  try {
    const response = await fetch(`${baseUrl()}/auth/status`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}`,
        ...metaHeaders(meta),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.ok)
      return { status: "ok", user: (await response.json()) as IUser };
    if (response.status === 401 || response.status === 403)
      return { status: "unauthorized" };
    return { status: "unavailable" };
  } catch (error) {
    console.error("[auth] status request failed:", error);
    return { status: "unavailable" };
  }
}

export function tokenSubject(token: string): string | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(part.length / 4) * 4, "=");
    const payload = JSON.parse(atob(base64)) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const setCookieName = (raw: string) =>
  raw.slice(0, raw.indexOf("=")).trim();

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function applySetCookiesToRequest(
  request: NextRequest,
  setCookies: string[],
) {
  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq < 1) continue;

    const name = pair.slice(0, eq).trim();
    const value = safeDecode(pair.slice(eq + 1).trim());
    const expires = /;\s*expires=([^;]+)/i.exec(raw)?.[1];
    const removed =
      value === "" ||
      /;\s*max-age=(0|-\d+)\b/i.test(raw) ||
      (expires !== undefined && Date.parse(expires) <= Date.now());

    if (removed) request.cookies.delete(name);
    else request.cookies.set(name, value);
  }
}
