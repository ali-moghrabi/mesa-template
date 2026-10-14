import { NextResponse, type NextRequest } from "next/server";

const TOKEN = /^[0-9a-f]{64}$/;
const api = () =>
  (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(
    /\/+$/,
    "",
  );

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!TOKEN.test(token) || !api())
    return new NextResponse(null, { status: 400 });
  const response = await fetch(`${api()}/newsletter/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return new NextResponse(null, {
    status: response && (response.ok || response.status === 404) ? 200 : 502,
  });
}

export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  return NextResponse.redirect(
    new URL(
      TOKEN.test(token) ? `/newsletter?unsubscribe=${token}` : "/newsletter",
      request.url,
    ),
  );
}
