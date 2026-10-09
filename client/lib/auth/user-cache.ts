import { sealData, unsealData } from "iron-session";
import { sessionOptions } from "@/lib/auth/session-options";

export const USER_CACHE_SECONDS = 5 * 60;

export type CachedUser = { v: 1; sub: string; user: IUser };

const ironOptions = () => ({
  password: sessionOptions.password,
  ttl: USER_CACHE_SECONDS,
});

export function sealUser(sub: string, user: IUser): Promise<string> {
  const data: CachedUser = { v: 1, sub, user };
  return sealData(data, ironOptions());
}

export async function readCachedUser(
  sealed: string | undefined,
): Promise<CachedUser | null> {
  if (!sealed) return null;
  try {
    const data = await unsealData<Partial<CachedUser>>(sealed, ironOptions());
    return data?.v === 1 && typeof data.sub === "string" && data.user
      ? (data as CachedUser)
      : null;
  } catch {
    return null;
  }
}

export const userCookieOptions = () => ({
  ...sessionOptions.cookieOptions,
  maxAge: USER_CACHE_SECONDS,
});
