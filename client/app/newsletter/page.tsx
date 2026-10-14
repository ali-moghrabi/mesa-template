import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AlertTriangle, Mail } from "lucide-react";
import { getConfig } from "@/config/loader";
import { getNewsletterToken } from "@/lib/actions/newsletter.actions";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { NewsletterManage, State } from "@/components/shared/NewsletterManage";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return {
    title: `Newsletter | ${brand.name}`,
    robots: { index: false, follow: false },
  };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewsletterPage({ searchParams }: Props) {
  const config = getConfig() as unknown as {
    brand: { name: string };
    features?: { newsletter?: boolean };
    legal?: { privacy?: unknown };
  };
  const enabled = config.features?.newsletter === true;
  const privacyHref = config.legal?.privacy ? "/legal/privacy" : undefined;
  const params = await searchParams;
  const one = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  const confirm = one("confirm");
  const unsubscribe = one("unsubscribe");
  const mode = unsubscribe ? "unsubscribe" : confirm ? "confirm" : null;

  const signup = enabled && (
    <NewsletterForm
      privacyHref={privacyHref}
      className="mx-auto mt-8 max-w-md text-left"
    />
  );

  if (!mode) {
    if (!enabled) notFound();
    return (
      <Shell>
        <State
          icon={<Mail />}
          tone="brand"
          title={`The ${config.brand.name} newsletter`}
        >
          <p>
            Seasonal menus, events and offers, straight to your inbox. A few
            emails a month at most.
          </p>
        </State>
        {signup}
      </Shell>
    );
  }

  const token = (unsubscribe ?? confirm)!;
  const result = await getNewsletterToken(mode, token);

  if (!result.ok) {
    return (
      <Shell>
        <State
          icon={<AlertTriangle />}
          tone="warning"
          title={
            result.gone
              ? "This link isn't valid anymore"
              : "Something went wrong"
          }
        >
          <p>
            {result.message}
            {result.gone &&
              mode === "confirm" &&
              enabled &&
              " Sign up again below and we'll send you a fresh link."}
          </p>
        </State>
        {mode === "confirm" && signup}
      </Shell>
    );
  }

  return (
    <Shell>
      <NewsletterManage
        mode={mode}
        token={token}
        info={result.data}
        brandName={config.brand.name}
      />
      {mode === "confirm" && result.data.expired && signup}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="relative isolate overflow-hidden px-4 py-20 sm:py-28 h-screen flex items-center justify-center">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-112 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_65%)]"
      />
      <div className="mx-auto max-w-xl rounded-[calc(var(--radius)*3)] border border-border bg-card/80 px-6 py-12 shadow-[0_40px_100px_-50px_rgba(0,0,0,.45)] backdrop-blur sm:px-12 sm:py-14">
        {children}
      </div>
    </main>
  );
}
