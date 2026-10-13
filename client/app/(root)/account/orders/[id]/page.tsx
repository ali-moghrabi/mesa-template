import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireUser } from "@/lib/auth/get-user";
import { adminFetch } from "@/admin/lib/menu/api";
import { ORDERS_ROUTE, type OrderView } from "@/lib/checkout";
import { OrderReceipt } from "@/components/checkout/OrderReceipt";
import QueryWrapper from "@/components/providers/query-wrapper";

const OBJECT_ID = /^[0-9a-f]{24}$/i;

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Order details | ${brand.name}`, robots: { index: false } };
}

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const config = getConfig();
  const result = OBJECT_ID.test(id)
    ? await adminFetch<OrderView>(`/orders/${id}`)
    : null;

  if (!result?.ok || result.data.status === "awaiting_payment") {
    return (
      <main className="min-h-svh bg-background px-(--pad) pt-[calc(var(--nav-height,4.5rem)+4rem)] pb-24 text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)]">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-muted px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-background text-foreground/60 shadow-sm">
            <SearchX className="size-6" />
          </span>
          <h1 className="mt-5 text-xl font-medium">
            We couldn&apos;t find this order
          </h1>
          <p className="mt-1.5 max-w-sm text-pretty text-foreground/65">
            {result && !result.ok && result.status !== 404
              ? result.message
              : "It may belong to another account, or the link is incomplete."}
          </p>
          <Link
            href={ORDERS_ROUTE}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 font-semibold text-background"
          >
            <ArrowLeft className="size-4" /> All orders
          </Link>
        </div>
      </main>
    );
  }

  return (
    <QueryWrapper>
      <OrderReceipt
        order={result.data}
        currency={config.menu.currency}
        brandName={config.brand.name}
        phone={config.business?.phone}
        context="account"
        canReorder={config.features?.onlineOrdering === true}
      />
    </QueryWrapper>
  );
}
