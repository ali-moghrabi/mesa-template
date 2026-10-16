import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireUser } from "@/lib/auth/get-user";
import { adminFetch } from "@/admin/lib/menu/api";
import type { OrderView } from "@/lib/checkout";
import { OrderReceipt } from "@/components/checkout/OrderReceipt";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Your order | ${brand.name}`, robots: { index: false } };
}

const OBJECT_ID = /^[0-9a-f]{24}$/i;

export default async function OrderCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  await requireUser();
  const { order: raw } = await searchParams;
  const id = typeof raw === "string" && OBJECT_ID.test(raw) ? raw : null;
  const config = getConfig();

  const result = id
    ? await adminFetch<OrderView>(`/orders/${id}/confirm-payment`, {
        method: "POST",
      })
    : null;

  if (!result?.ok) {
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
            {result && result.status !== 404
              ? result.message
              : "The link may be incomplete, or the order belongs to another account."}
          </p>
          <Link
            href="/menu"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 font-semibold text-background transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="size-4" /> Back to the menu
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
        whatsapp={
          config.features?.whatsappOrdering
            ? config.business?.whatsapp?.number
            : undefined
        }
      />
    </QueryWrapper>
  );
}
