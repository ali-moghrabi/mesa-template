"use server";

import { cookies, headers } from "next/headers";
import { forwardIpHeaders, visitorIp } from "@/lib/api-forward";
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
import type { SetupInfo } from "@/lib/two-factor";

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
    const ip = visitorIp(h);
    const response = await fetch(`${apiBase()}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...forwardIpHeaders(ip),
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

const codeProblem = (code: unknown) =>
  typeof code !== "string" || code.trim().length < 6 || code.length > 32
    ? invalid({ code: "Enter the 6-digit code from your app" })
    : null;

export async function startTwoFactor(
  code?: string,
): Promise<ApiResult<SetupInfo>> {
  await requireUser();
  if (code !== undefined) {
    const bad = codeProblem(code);
    if (bad) return bad;
  }
  return adminFetch<SetupInfo>("/account/2fa/setup", {
    method: "POST",
    body: code ? { code: code.trim() } : {},
  });
}

export async function enableTwoFactor(
  code: string,
): Promise<ApiResult<{ recoveryCodes: string[] }>> {
  await requireUser();
  const bad = codeProblem(code);
  if (bad) return bad;
  const result = await adminFetch<{ recoveryCodes: string[] }>(
    "/account/2fa/enable",
    { method: "POST", body: { code: code.trim() } },
  );
  if (result.ok) await refetchSessionCookie();
  return result;
}

export async function disableTwoFactor(values: {
  code: string;
  password?: string;
}): Promise<ApiResult<{ ok: true }>> {
  await requireUser();
  const bad = codeProblem(values?.code);
  if (bad) return bad;
  const result = await adminFetch<{ ok: true }>("/account/2fa/disable", {
    method: "POST",
    body: {
      code: values.code.trim(),
      ...(values.password && { password: values.password }),
    },
  });
  if (result.ok) {
    await refetchSessionCookie();
    revalidatePath("/account");
  }
  return result;
}

export async function newRecoveryCodes(
  code: string,
): Promise<ApiResult<{ recoveryCodes: string[] }>> {
  await requireUser();
  const bad = codeProblem(code);
  if (bad) return bad;
  return adminFetch<{ recoveryCodes: string[] }>(
    "/account/2fa/recovery-codes",
    {
      method: "POST",
      body: { code: code.trim() },
    },
  );
}

export async function forgetTrustedDevices(): Promise<ApiResult<{ ok: true }>> {
  await requireUser();
  const result = await adminFetch<{ ok: true }>("/account/2fa/forget-devices", {
    method: "POST",
  });
  if (result.ok) revalidatePath("/account");
  return result;
}
