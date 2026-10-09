"use server";

import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "@/constants/constants";
import { sessionOptions } from "./session-options";
import { fetchUser, tokenSubject } from "@/lib/auth/api-session";
import { sealUser, userCookieOptions } from "@/lib/auth/user-cache";

export async function refetchSessionCookie(): Promise<{ ok: boolean }> {
  const store = await cookies();
  const access = store.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!access) {
    store.delete(sessionOptions.cookieName);
    return { ok: false };
  }

  const result = await fetchUser(access);
  if (result.status !== "ok") {
    if (result.status === "unauthorized")
      store.delete(sessionOptions.cookieName);
    return { ok: false };
  }

  store.set(
    sessionOptions.cookieName,
    await sealUser(tokenSubject(access) ?? "", result.user),
    userCookieOptions(),
  );
  return { ok: true };
}
