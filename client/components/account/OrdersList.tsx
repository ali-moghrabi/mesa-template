"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  ChevronRight,
  Loader2,
  Receipt,
  RotateCw,
  ShoppingBag,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { canOptimize, mediaSrc } from "@/admin/lib/menu/format";
import { formatMoney, type CurrencyConfig } from "@/lib/menu/money";
import { CART_KEY, CHECKOUT_ROUTE } from "@/lib/cart";
import { loadMoreOrders, reorder } from "@/lib/actions/orders.actions";
import {
  ORDERS_ROUTE,
  STATUS_STEPS,
  statusLabel,
  type MyOrders,
  type OrderView,
} from "@/lib/checkout";

const REFRESH_MS = 30_000;

type Props = {
  initial: MyOrders;
  currency: CurrencyConfig;
  orderingOn: boolean;
};

export function OrdersList({ initial, currency, orderingOn }: Props) {
  const router = useRouter();
  const money = (n: number) => formatMoney(n, currency).main;

  const [more, setMore] = useState<OrderView[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const nextBefore = cursor === undefined ? initial.nextBefore : cursor;
  const past = [
    ...initial.past,
    ...more.filter((o) => !initial.past.some((p) => p.id === o.id)),
  ];

  const live = initial.active.length > 0;
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [live, router]);

  const loadMore = async () => {
    if (!nextBefore || loading) return;
    setLoading(true);
    const result = await loadMoreOrders(nextBefore);
    setLoading(false);
    if (!result.ok) {
      toast.add({
        title: "Couldn't load more orders",
        description: result.message,
        type: "error",
      });
      return;
    }
    setMore((list) => [...list, ...result.data.past]);
    setCursor(result.data.nextBefore);
  };

  const empty = initial.active.length === 0 && past.length === 0;

  return (
    <main className="min-h-svh bg-background pb-24 text-foreground [--pad:clamp(1rem,4vw,3rem)]">
      <div className="mx-auto max-w-4xl px-(--pad) pt-[calc(var(--nav-height,4.5rem)+1.75rem)]">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Your account
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your orders
            </h1>
            <p className="mt-1 text-foreground/60">
              Track what&apos;s on its way, or order a favourite again.
            </p>
          </div>
          {orderingOn && !empty && (
            <Link
              href="/menu"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              <ShoppingBag className="size-4" /> New order
            </Link>
          )}
        </div>

        {empty ? (
          <div className="mt-10 flex flex-col items-center rounded-[calc(var(--radius)*2)] border border-dashed border-foreground/15 px-6 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
              <Receipt className="size-7" />
            </span>
            <h2 className="mt-5 text-xl font-semibold">No orders yet</h2>
            <p className="mt-1.5 max-w-sm text-pretty text-foreground/60">
              When you order, it shows up here so you can follow it and order it
              again in one tap.
            </p>
            {orderingOn && (
              <Link
                href="/menu"
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground"
              >
                Browse the menu <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        ) : (
          <>
            {initial.active.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground/55 uppercase">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                  In progress
                </h2>
                <div className="space-y-4">
                  {initial.active.map((order) => (
                    <ActiveCard key={order.id} order={order} money={money} />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground/55 uppercase">
                  Past orders
                </h2>
                <ul className="divide-y divide-foreground/10 overflow-hidden rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-card">
                  {past.map((order) => (
                    <PastRow
                      key={order.id}
                      order={order}
                      money={money}
                      canReorder={orderingOn}
                    />
                  ))}
                </ul>
                {nextBefore && (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loading}
                      className="inline-flex h-11 items-center gap-2 rounded-full border border-foreground/15 px-5 text-sm font-semibold transition-colors hover:bg-foreground/4 disabled:opacity-60"
                    >
                      {loading && <Loader2 className="size-4 animate-spin" />}{" "}
                      Show older orders
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function ActiveCard({
  order,
  money,
}: {
  order: OrderView;
  money: (n: number) => string;
}) {
  const steps = STATUS_STEPS[order.type];
  const current = Math.max(
    0,
    steps.findIndex((s) => s.status === order.status),
  );
  const tz = order.schedule.timezone;
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(order.schedule.from));
  const eta = order.schedule.asap
    ? `${time(order.schedule.from)} – ${time(order.schedule.to)}`
    : `${day}, ${time(order.schedule.from)}`;
  const delivery = order.type === "delivery";

  return (
    <Link
      href={`${ORDERS_ROUTE}/${order.id}`}
      className="group block overflow-hidden rounded-[calc(var(--radius)*2)] border border-primary/25 bg-card shadow-[0_18px_50px_-30px_var(--primary)] transition-all hover:-translate-y-0.5 hover:border-primary/45"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            {delivery ? (
              <Bike className="size-5" />
            ) : (
              <Store className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-foreground/55">
              Order #{order.number} · {delivery ? "Delivery" : "Pickup"}
            </p>
            <p className="text-xl font-semibold tracking-tight">
              {statusLabel(order)}
            </p>
            <p className="mt-0.5 truncate text-sm text-foreground/60">
              {summary(order)}
            </p>
          </div>
        </div>
        <div className="pl-[3.6rem] sm:pl-0 sm:text-right">
          <p className="text-sm text-foreground/55">
            {order.schedule.asap
              ? delivery
                ? "Arriving"
                : "Ready"
              : "Scheduled"}
          </p>
          <p className="text-lg font-semibold tabular-nums">{eta}</p>
        </div>
      </div>

      <div className="px-5 pb-5 sm:px-6">
        <div
          className="flex gap-1.5"
          aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]?.label}`}
        >
          {steps.map((step, i) => (
            <span
              key={step.status}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= current ? "bg-primary" : "bg-foreground/10",
                i === current && "animate-pulse",
              )}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-foreground/50">
          <span>{steps[0].label}</span>
          <span>{steps[steps.length - 1].label}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-foreground/10 bg-muted/40 px-5 py-3 sm:px-6">
        <Thumbs order={order} />
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          {money(order.amounts.total)} · Track{" "}
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function PastRow({
  order,
  money,
  canReorder,
}: {
  order: OrderView;
  money: (n: number) => string;
  canReorder: boolean;
}) {
  const cancelled = order.status === "cancelled";
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: order.schedule.timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(order.createdAt));
  return (
    <li className="relative flex flex-col gap-3 p-4 transition-colors hover:bg-foreground/2.5 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <Thumbs order={order} className="sm:w-35" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Link
            href={`${ORDERS_ROUTE}/${order.id}`}
            className="font-semibold after:absolute after:inset-0 hover:underline"
          >
            #{order.number}
          </Link>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              cancelled
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
            )}
          >
            {statusLabel(order)}
          </span>
          <span className="text-sm text-foreground/50">{date}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-foreground/60">
          {summary(order)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span
          className={cn(
            "font-semibold tabular-nums",
            cancelled && "text-foreground/40 line-through",
          )}
        >
          {money(order.amounts.total)}
        </span>
        {canReorder && (
          <ReorderButton orderId={order.id} compact className="relative z-10" />
        )}
      </div>
    </li>
  );
}

function summary(order: OrderView) {
  const names = order.lines
    .slice(0, 2)
    .map((l) => (l.quantity > 1 ? `${l.quantity}× ${l.name}` : l.name));
  const rest = order.lines.length - 2;
  return names.join(", ") + (rest > 0 ? ` +${rest} more` : "");
}

function Thumbs({
  order,
  className,
}: {
  order: OrderView;
  className?: string;
}) {
  const shown = order.lines.slice(0, 3);
  const rest = order.lines.length - shown.length;
  return (
    <div className={cn("flex shrink-0 -space-x-3", className)}>
      {shown.map((line, i) => {
        const src = mediaSrc(line.image);
        return (
          <span
            key={i}
            className="relative size-11 overflow-hidden rounded-full bg-muted ring-2 ring-card"
          >
            {src ? (
              <Image
                src={src}
                alt=""
                fill
                sizes="44px"
                unoptimized={!canOptimize(src)}
                className="object-cover"
              />
            ) : (
              <UtensilsCrossed className="absolute inset-0 m-auto size-4 text-foreground/30" />
            )}
          </span>
        );
      })}
      {rest > 0 && (
        <span className="relative grid size-11 place-items-center rounded-full bg-foreground/8 text-xs font-bold ring-2 ring-card">
          +{rest}
        </span>
      )}
    </div>
  );
}

export function ReorderButton({
  orderId,
  compact,
  className,
}: {
  orderId: string;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    const result = await reorder(orderId);
    if (!result.ok) {
      setBusy(false);
      toast.add({
        title: "Couldn't order again",
        description: result.message,
        type: "error",
      });
      return;
    }
    const { cart, added, skipped } = result.data;
    queryClient.setQueryData(CART_KEY, cart);
    if (skipped.length > 0) {
      toast.add({
        title:
          added > 0
            ? `${skipped.length === 1 ? "One dish" : `${skipped.length} dishes`} couldn't be added`
            : "Nothing could be added",
        description: skipped.map((s) => `${s.name}: ${s.reason}`).join(" · "),
        type: "warning",
      });
    }
    if (added === 0) {
      setBusy(false);
      return;
    }
    if (skipped.length === 0)
      toast.add({
        title: "Added to your cart",
        description: `${added} ${added === 1 ? "dish" : "dishes"}, at today's prices.`,
        type: "success",
      });
    router.push(CHECKOUT_ROUTE);
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold transition-all disabled:opacity-60",
        compact
          ? "h-9 border border-foreground/15 px-3.5 text-sm hover:border-primary hover:text-primary"
          : "h-11 bg-primary px-5 text-white hover:brightness-105",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RotateCw className="size-4" />
      )}{" "}
      Order again
    </button>
  );
}
