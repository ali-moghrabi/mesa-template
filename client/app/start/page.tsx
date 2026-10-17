import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getConfig } from "@/config/loader";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { onboardingEnabled } from "@/components/onboarding/DemoPromo";

export const metadata: Metadata = {
  title: "Start your website | MESA",
  description:
    "Tell us about your restaurant in about 10 minutes. We build your website from it.",
  robots: { index: false, follow: false },
};

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  if (!onboardingEnabled()) notFound();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL;
  if (!apiUrl)
    throw new Error(
      "Set NEXT_PUBLIC_API_URL (e.g. https://api.mesa-template.store/api/v1)",
    );

  const { plan } = await searchParams;
  return (
    <Onboarding
      apiUrl={apiUrl}
      base={getConfig() as unknown as Record<string, unknown>}
      plan={typeof plan === "string" ? plan : undefined}
    />
  );
}
