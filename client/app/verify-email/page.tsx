import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getConfig } from "@/config/loader";
import { getUserSession } from "@/lib/auth/get-user";
import { checkVerifyLink } from "@/lib/actions/account.actions";
import { LinkProblem, VerifyEmail } from "@/components/auth/VerifyEmail";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return {
    title: `Verify your email | ${brand.name}`,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { brand } = getConfig();
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const [user, result] = await Promise.all([
    getUserSession(),
    checkVerifyLink(token),
  ]);
  const signedIn = user !== null;

  return (
    <Shell>
      {result.ok ? (
        <VerifyEmail
          token={token}
          info={result.data}
          signedIn={signedIn}
          brandName={brand.name}
        />
      ) : (
        <LinkProblem message={result.message} signedIn={signedIn} />
      )}
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
