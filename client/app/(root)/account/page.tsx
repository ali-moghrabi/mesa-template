import type { Metadata } from "next";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireUser } from "@/lib/auth/get-user";
import { canAccessAdmin } from "@/lib/auth/user-roles";
import { adminFetch } from "@/admin/lib/menu/api";
import type { Account } from "@/lib/account";
import { AccountView } from "@/components/common/AccountView";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Your account | ${brand.name}`, robots: { index: false } };
}

const ROLE_LABELS: Record<string, string> = {
  staff: "Staff",
  manager: "Manager",
  admin: "Admin",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  await requireUser();
  const { setup } = await searchParams;
  const { features, business, brand } = getConfig();
  const result = await adminFetch<Account>("/account");

  if (!result.ok) {
    return (
      <main
        data-nav-dark=""
        className="min-h-svh bg-background px-(--pad) pt-[calc(var(--nav-height,4.5rem)+4rem)] pb-24 text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)]"
      >
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-muted px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-background text-foreground/60 shadow-sm">
            <TriangleAlert className="size-6" />
          </span>
          <p className="mt-5 text-xl font-medium">
            Your account didn&apos;t load
          </p>
          <p className="mt-1.5 max-w-sm text-pretty text-foreground/65">
            {result.message}
          </p>
          <Link
            href="/account"
            prefetch={false}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 font-semibold text-background transition-opacity hover:opacity-90"
          >
            <RotateCw className="size-4" /> Try again
          </Link>
        </div>
      </main>
    );
  }

  const account = result.data;
  const timeZone = business.timezone;
  const memberSince = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(account.createdAt));
  const lastSignIn = account.lastLoginAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone,
      })
        .format(new Date(account.lastLoginAt))
        .replace(",", " at")
    : undefined;

  return (
    <QueryWrapper>
      <AccountView
        account={account}
        memberSince={memberSince}
        lastSignIn={lastSignIn}
        brandName={brand.name}
        setupTwoFactor={setup === "2fa"}
        features={{
          reservations: features?.reservations === true,
          ordering: features?.onlineOrdering === true,
        }}
        team={
          canAccessAdmin(account.role)
            ? { roleLabel: ROLE_LABELS[account.role] ?? "Team" }
            : null
        }
      />
    </QueryWrapper>
  );
}
