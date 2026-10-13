import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  RotateCw,
  ShoppingBag,
  Store,
  TriangleAlert,
} from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireUser } from "@/lib/auth/get-user";
import { adminFetch } from "@/admin/lib/menu/api";
import type { CheckoutInfo } from "@/lib/checkout";
import { Checkout } from "@/components/checkout/Checkout";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Checkout | ${brand.name}`, robots: { index: false } };
}

export default async function CheckoutPage() {
  await requireUser();
  const config = getConfig();
  const currency = config.menu.currency;

  if (config.features?.onlineOrdering !== true) {
    return (
      <Notice
        icon={<Store className="size-6" />}
        title="Online ordering is closed"
        text={`You can still enjoy ${config.brand.name}: call us to order, or come by.`}
        action={{ href: "/menu", label: "See the menu" }}
      />
    );
  }

  const result = await adminFetch<CheckoutInfo>("/orders/checkout");
  if (!result.ok) {
    return (
      <Notice
        icon={<TriangleAlert className="size-6" />}
        title={
          result.status === 403
            ? "Online ordering is closed"
            : "Checkout didn't load"
        }
        text={result.message}
        action={{
          href: "/payment/checkout",
          label: "Try again",
          icon: <RotateCw className="size-4" />,
        }}
      />
    );
  }

  if (result.data.cart.lines.length === 0) {
    return (
      <Notice
        icon={<ShoppingBag className="size-6" />}
        title="Your cart is empty"
        text="Add a few dishes from the menu, then come back here to order."
        action={{ href: "/menu", label: "Browse the menu" }}
      />
    );
  }

  return (
    <QueryWrapper>
      <Checkout
        info={result.data}
        currency={currency}
        brandName={config.brand.name}
      />
    </QueryWrapper>
  );
}

function Notice({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action: { href: string; label: string; icon?: React.ReactNode };
}) {
  return (
    <main className="min-h-svh bg-background px-(--pad) pt-[calc(var(--nav-height,4.5rem)+4rem)] pb-24 text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)]">
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-muted px-6 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-background text-foreground/60 shadow-sm">
          {icon}
        </span>
        <h1 className="mt-5 text-xl font-medium">{title}</h1>
        <p className="mt-1.5 max-w-sm text-pretty text-foreground/65">{text}</p>
        <Link
          href={action.href}
          prefetch={false}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 font-semibold text-background transition-opacity hover:opacity-90"
        >
          {action.icon ?? <ArrowLeft className="size-4" />} {action.label}
        </Link>
      </div>
    </main>
  );
}
