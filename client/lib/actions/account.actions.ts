"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/constants/constants";
import { sessionOptions } from "@/lib/auth/session-options";
import { getUserSession, requireUser } from "@/lib/auth/get-user";
import { refetchSessionCookie } from "@/lib/auth/session-updates";
import { adminFetch, type ApiResult } from "@/admin/lib/menu/api";
import {
  deleteSchemaFor,
  passwordSchemaFor,
  profileSchema,
  VERIFY_TOKEN_PATTERN,
  type Account,
  type VerificationState,
  type VerifyLinkInfo,
  type VerifyLinkResult,
} from "@/lib/account";

const invalid = (fieldErrors: Record<string, string>) => ({
  ok: false as const,
  status: 400,
  message: "Please fix the highlighted fields",
  fieldErrors,
});
const firstErrors = (issues: { path: PropertyKey[]; message: string }[]) =>
  Object.fromEntries(
    issues.map((i) => [String(i.path[0]), i.message]).reverse(),
  );

export async function updateProfile(
  values: unknown,
): Promise<ApiResult<Account>> {
  await requireUser();
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return invalid(firstErrors(parsed.error.issues));

  const result = await adminFetch<Account>("/account", {
    method: "PATCH",
    body: parsed.data,
  });
  if (result.ok) {
    await refetchSessionCookie();
    revalidatePath("/account");
  }
  return result;
}

export async function changePassword(
  values: unknown,
): Promise<ApiResult<{ ok: true }>> {
  await requireUser();

  const parsed = passwordSchemaFor(false).safeParse(values);
  if (!parsed.success) return invalid(firstErrors(parsed.error.issues));
  const { currentPassword, newPassword } = parsed.data;
  return adminFetch<{ ok: true }>("/account/password", {
    method: "POST",
    body: { currentPassword: currentPassword || undefined, newPassword },
  });
}

export async function sendVerificationEmail(): Promise<
  ApiResult<VerificationState>
> {
  await requireUser();
  const result = await adminFetch<VerificationState>("/account/verify-email", {
    method: "POST",
  });
  if (result.ok && result.data.status === "verified") {
    await refetchSessionCookie();
    revalidatePath("/account");
  }
  return result;
}

const apiBase = () =>
  (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(
    /\/+$/,
    "",
  );

async function verifyCall(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<VerifyLinkResult> {
  if (!apiBase())
    return {
      ok: false,
      gone: false,
      message: "The website isn't connected to the server yet (API_URL).",
    };
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      undefined;
    const response = await fetch(`${apiBase()}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(ip && { "X-Forwarded-For": ip }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await response.json().catch(() => null)) as
      | ({ message?: string | string[] } & Record<string, unknown>)
      | null;
    if (response.ok)
      return { ok: true, data: data as unknown as VerifyLinkInfo };
    if (response.status === 429)
      return {
        ok: false,
        gone: false,
        message: "Too many tries. Please wait a minute and try again.",
      };
    const message =
      (Array.isArray(data?.message) ? data.message[0] : data?.message) ||
      "That didn't work. Please try again.";

    return {
      ok: false,
      gone: [400, 404, 410].includes(response.status),
      message,
    };
  } catch (error) {
    console.error("[verify-email]", error);
    return {
      ok: false,
      gone: false,
      message: "We couldn't reach the server. Please try again in a moment.",
    };
  }
}

export async function checkVerifyLink(
  token: string,
): Promise<VerifyLinkResult> {
  if (!VERIFY_TOKEN_PATTERN.test(token))
    return {
      ok: false,
      gone: true,
      message:
        "This link isn't complete. Open it straight from the email, or ask for a new one.",
    };
  return verifyCall(
    `/email-verification?${new URLSearchParams({ token })}`,
    "GET",
  );
}

export async function confirmEmail(token: string): Promise<VerifyLinkResult> {
  if (!VERIFY_TOKEN_PATTERN.test(token))
    return {
      ok: false,
      gone: true,
      message:
        "This link isn't complete. Open it straight from the email, or ask for a new one.",
    };
  const result = await verifyCall("/email-verification/confirm", "POST", {
    token,
  });
  if (result.ok && (await getUserSession())) {
    await refetchSessionCookie();
    revalidatePath("/account");
  }
  return result;
}

export async function signOutEverywhere(): Promise<ApiResult<{ ok: true }>> {
  await requireUser();
  const result = await adminFetch<{ ok: true }>(
    "/account/sign-out-everywhere",
    { method: "POST" },
  );
  if (result.ok) await clearSessionCookies();
  return result;
}

export async function deleteAccount(
  values: unknown,
): Promise<ApiResult<{ ok: true }>> {
  await requireUser();
  const parsed = deleteSchemaFor(false).safeParse(values);
  if (!parsed.success) return invalid(firstErrors(parsed.error.issues));
  const result = await adminFetch<{ ok: true }>("/account/delete", {
    method: "POST",
    body: { password: parsed.data.password || undefined },
  });
  if (result.ok) await clearSessionCookies();
  return result;
}

async function clearSessionCookies() {
  const store = await cookies();
  const domain = process.env.COOKIE_DOMAIN || undefined;
  store.delete({ name: ACCESS_TOKEN_COOKIE, path: "/", domain });
  store.delete({ name: REFRESH_TOKEN_COOKIE, path: "/", domain });
  store.delete({ name: sessionOptions.cookieName, path: "/" });
}
