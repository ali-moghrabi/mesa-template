import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth/get-user";
import { FALLBACK_ROUTE } from "@/lib/auth/routes";
import { getConfig } from "@/config/loader";
import { ForgotPasswordForm } from "@/components/auth/PasswordReset";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return {
    title: `Forgot your password? | ${brand.name}`,
    robots: { index: false },
  };
}

export default async function ForgotPasswordPage() {
  if (await getUserSession()) redirect(FALLBACK_ROUTE);
  return (
    <QueryWrapper>
      <ForgotPasswordForm />
    </QueryWrapper>
  );
}
