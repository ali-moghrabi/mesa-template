import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/constants/constants";
import { sessionOptions } from "@/lib/auth/session-options";
import {
  applySetCookiesToRequest,
  clientMeta,
  fetchUser,
  renewSession,
  setCookieName,
  tokenSubject,
} from "@/lib/auth/api-session";
import {
  readCachedUser,
  sealUser,
  userCookieOptions,
} from "@/lib/auth/user-cache";
import {
  ADMIN_ROUTE,
  FALLBACK_ROUTE,
  PROTECTED_ROUTES,
  isMatch,
} from "@/lib/auth/routes";
import { canAccessAdmin } from "@/lib/auth/user-roles";

const USER_COOKIE = sessionOptions.cookieName;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const jar = new CookieJar(request);
  const user = await resolveSession(request, jar);

  const deniedAdmin =
    isMatch(pathname, [ADMIN_ROUTE]) && !canAccessAdmin(user?.role);
  const deniedPage = user === null && isMatch(pathname, PROTECTED_ROUTES);

  if (deniedAdmin || deniedPage) {
    return jar.applyTo(
      NextResponse.redirect(new URL(FALLBACK_ROUTE, request.url)),
    );
  }

  return jar.applyTo(
    NextResponse.next({ request: { headers: request.headers } }),
  );
}

async function resolveSession(
  request: NextRequest,
  jar: CookieJar,
): Promise<IUser | null> {
  const meta = clientMeta(request);
  const readAccess = () => request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  let renewed = false;
  const renew = async () => {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    if (!refreshToken || renewed) return;
    renewed = true;

    const result = await renewSession(refreshToken, meta);
    if (result.status === "unavailable") return;
    jar.forward(result.setCookies);
  };

  let access = readAccess();
  if (!access) {
    await renew();
    access = readAccess();
  }

  if (!access) {
    if (
      !request.cookies.has(REFRESH_TOKEN_COOKIE) &&
      request.cookies.has(USER_COOKIE)
    )
      jar.delete(USER_COOKIE);
    return null;
  }

  const cached = await readCachedUser(request.cookies.get(USER_COOKIE)?.value);
  if (cached && cached.sub === tokenSubject(access)) return cached.user;

  let result = await fetchUser(access, meta);
  if (result.status === "unauthorized") {
    const refused = access;
    await renew();
    access = readAccess();
    if (access && access !== refused) result = await fetchUser(access, meta);
  }

  if (result.status === "ok" && access) {
    jar.set(
      USER_COOKIE,
      await sealUser(tokenSubject(access) ?? "", result.user),
      userCookieOptions(),
    );
    return result.user;
  }

  if (result.status === "unauthorized") {
    jar.delete(ACCESS_TOKEN_COOKIE, process.env.COOKIE_DOMAIN);
    jar.delete(USER_COOKIE);
  }
  return null;
}

class CookieJar {
  private forwarded: string[] = [];
  private changes = new Map<
    string,
    { value: string; options: Record<string, unknown> }
  >();

  constructor(private readonly request: NextRequest) {}

  forward(setCookies: string[]) {
    applySetCookiesToRequest(this.request, setCookies);
    this.forwarded.push(...setCookies);
  }

  set(name: string, value: string, options: Record<string, unknown>) {
    this.request.cookies.set(name, value);
    this.forwarded = this.forwarded.filter(
      (raw) => setCookieName(raw) !== name,
    );
    this.changes.set(name, { value, options });
  }

  delete(name: string, domain?: string) {
    this.request.cookies.delete(name);
    this.forwarded = this.forwarded.filter(
      (raw) => setCookieName(raw) !== name,
    );
    this.changes.set(name, {
      value: "",
      options: { path: "/", maxAge: 0, ...(domain && { domain }) },
    });
  }

  applyTo<T extends NextResponse>(response: T): T {
    for (const [name, { value, options }] of this.changes)
      response.cookies.set(name, value, options);
    for (const raw of this.forwarded)
      response.headers.append("set-cookie", raw);
    return response;
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
