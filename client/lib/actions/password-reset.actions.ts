"use server";

import { cookies, headers } from "next/headers";
import { forwardIpHeaders, visitorIp } from "@/lib/api-forward";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/constants/constants";
import { sessionOptions } from "@/lib/auth/session-options";
import {
  RESET_COOKIE,
  RESET_COOKIE_PATH,
  RESET_DONE_COOKIE,
  TOKEN_PATTERN,
  forgotSchema,
  resetSchema,
} from "@/lib/password-reset";

type Result =
  | { ok: true; message: string }
  | { ok: false; message: string; expired?: boolean };

function apiUrl(path: string) {
  const base = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ""
  ).replace(/\/+$/, "");
  return `${base}${path}`;
}

async function post(
  path: string,
  body: unknown,
): Promise<{ status: number; data: { message?: string | string[] } | null }> {
  const h = await headers();
  const ip = visitorIp(h);
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...forwardIpHeaders(ip),
      "User-Agent": h.get("user-agent") ?? "",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  return {
    status: response.status,
    data: await response.json().catch(() => null),
  };
}

const messageOf = (
  data: { message?: string | string[] } | null,
  fallback: string,
) =>
  (Array.isArray(data?.message) ? data.message[0] : data?.message) || fallback;

export async function requestPasswordReset(values: unknown): Promise<Result> {
  const parsed = forgotSchema.safeParse(values);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Enter a valid email address",
    };
  try {
    const { status, data } = await post("/auth/forgot-password", parsed.data);
    if (status === 429)
      return {
        ok: false,
        message: "Too many requests. Wait a few minutes and try again.",
      };
    if (status >= 400)
      return {
        ok: false,
        message: messageOf(data, "Something went wrong. Try again."),
      };
    return {
      ok: true,
      message: messageOf(
        data,
        "If an account uses this email, a reset link is on its way.",
      ),
    };
  } catch (error) {
    console.error("[forgot-password]", error);
    return {
      ok: false,
      message: "Couldn't reach the server. Try again in a moment.",
    };
  }
}

export async function resetPassword(values: unknown): Promise<Result> {
  const parsed = resetSchema.safeParse(values);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check your new password",
    };

  const store = await cookies();
  const token = store.get(RESET_COOKIE)?.value;
  if (!token || !TOKEN_PATTERN.test(token))
    return {
      ok: false,
      expired: true,
      message: "This reset link has expired. Ask for a new one.",
    };

  try {
    const { status, data } = await post("/auth/reset-password", {
      token,
      password: parsed.data.password,
    });
    if (status === 429)
      return {
        ok: false,
        message: "Too many attempts. Wait a few minutes and try again.",
      };
    if (status >= 400) {
      const expired =
        status === 400 && /expired|used/i.test(messageOf(data, ""));
      if (expired)
        store.delete({ name: RESET_COOKIE, path: RESET_COOKIE_PATH });
      return {
        ok: false,
        expired,
        message: messageOf(data, "Your password didn't change. Try again."),
      };
    }
    store.delete({ name: RESET_COOKIE, path: RESET_COOKIE_PATH });
    store.set(RESET_DONE_COOKIE, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: RESET_COOKIE_PATH,
      maxAge: 5 * 60,
    });

    const domain = process.env.COOKIE_DOMAIN || undefined;
    store.delete({ name: ACCESS_TOKEN_COOKIE, path: "/", domain });
    store.delete({ name: REFRESH_TOKEN_COOKIE, path: "/", domain });
    store.delete({ name: sessionOptions.cookieName, path: "/" });
    return { ok: true, message: messageOf(data, "Your password is changed.") };
  } catch (error) {
    console.error("[reset-password]", error);
    return {
      ok: false,
      message: "Couldn't reach the server. Try again in a moment.",
    };
  }
}
