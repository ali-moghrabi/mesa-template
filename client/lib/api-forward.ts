import { headers } from "next/headers";

export function forwardIpHeaders(
  ip: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  const clean = ip?.trim();
  if (!clean) return out;
  out["X-Forwarded-For"] = clean;
  const key = process.env.API_PROXY_SECRET;
  if (key) {
    out["X-Mesa-Proxy-Key"] = key;
    out["X-Mesa-Client-IP"] = clean;
  }
  return out;
}

export function visitorIp(h: Headers): string | undefined {
  return (
    h.get("x-real-ip")?.trim() ||
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    undefined
  );
}

export async function requestIpHeaders(): Promise<Record<string, string>> {
  return forwardIpHeaders(visitorIp(await headers()));
}
