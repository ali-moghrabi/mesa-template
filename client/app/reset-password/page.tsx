import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth/get-user";
import { FALLBACK_ROUTE } from "@/lib/auth/routes";
import { cookies } from "next/headers";
import { getConfig } from "@/config/loader";
import {
  RESET_COOKIE,
  RESET_DONE_COOKIE,
  TOKEN_PATTERN,
} from "@/lib/password-reset";
import {
  LinkProblem,
  ResetDone,
  ResetPasswordForm,
} from "@/components/auth/PasswordReset";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return {
    title: `Choose a new password | ${brand.name}`,
    robots: { index: false },
    referrer: "no-referrer",
  };
}

type Check =
  | { valid: true; email: string; firstName: string }
  | { valid: false };

async function checkToken(token: string): Promise<Check> {
  const base = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ""
  ).replace(/\/+$/, "");
  try {
    const response = await fetch(`${base}/auth/reset-password/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    return response.ok ? ((await response.json()) as Check) : { valid: false };
  } catch (error) {
    console.error("[reset-password] check failed:", error);
    return { valid: false };
  }
}

export default async function ResetPasswordPage() {
  if (await getUserSession()) redirect(FALLBACK_ROUTE);
  const store = await cookies();
  const token = store.get(RESET_COOKIE)?.value;

  if (!token && store.has(RESET_DONE_COOKIE)) return <ResetDone />;

  const check =
    token && TOKEN_PATTERN.test(token)
      ? await checkToken(token)
      : ({ valid: false } as const);

  if (!check.valid) return <LinkProblem />;
  return (
    <QueryWrapper>
      <ResetPasswordForm firstName={check.firstName} email={check.email} />
    </QueryWrapper>
  );
}
