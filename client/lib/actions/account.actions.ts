"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/constants/constants";
import { sessionOptions } from "@/lib/auth/session-options";
import { requireUser } from "@/lib/auth/get-user";
import { refetchSessionCookie } from "@/lib/auth/session-updates";
import { adminFetch, type ApiResult } from "@/admin/lib/menu/api";
import {
  deleteSchemaFor,
  passwordSchemaFor,
  profileSchema,
  type Account,
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
