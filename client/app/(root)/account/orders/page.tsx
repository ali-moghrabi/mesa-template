import type { Metadata } from "next";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireUser } from "@/lib/auth/get-user";
import { adminFetch } from "@/admin/lib/menu/api";
import type { MyOrders } from "@/lib/checkout";
import { OrdersList } from "@/components/account/OrdersList";
import QueryWrapper from "@/components/providers/query-wrapper";
import { notFound } from "next/navigation";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Your orders | ${brand.name}`, robots: { index: false } };
}

export default async function AccountOrdersPage() {
  await requireUser();
  const config = getConfig();

  if (!config.features?.onlineOrdering) notFound();

  const result = await adminFetch<MyOrders>("/orders/mine");

  if (!result.ok) {
    return (
      <main className="min-h-svh bg-background px-(--pad) pt-[calc(var(--nav-height,4.5rem)+4rem)] pb-24 text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)]">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-muted px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-background text-foreground/60 shadow-sm">
            <TriangleAlert className="size-6" />
          </span>
          <h1 className="mt-5 text-xl font-medium">
            Your orders didn&apos;t load
          </h1>
          <p className="mt-1.5 max-w-sm text-pretty text-foreground/65">
            {result.message}
          </p>
          <Link
            href="/account/orders"
            prefetch={false}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 font-semibold text-background"
          >
            <RotateCw className="size-4" /> Try again
          </Link>
        </div>
      </main>
    );
  }

  return (
    <QueryWrapper>
      <OrdersList
        initial={result.data}
        currency={config.menu.currency}
        orderingOn={config.features?.onlineOrdering === true}
      />
    </QueryWrapper>
  );
}
