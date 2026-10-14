"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  Bike,
  CalendarClock,
  Check,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Phone,
  RotateCw,
  Store,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canOptimize, mediaSrc } from "@/admin/lib/menu/format";
import { formatMoney, type CurrencyConfig } from "@/lib/menu/money";
import { CART_KEY, CHECKOUT_ROUTE } from "@/lib/cart";
import {
  ORDERS_ROUTE,
  STATUS_STEPS,
  isActiveOrder,
  statusLabel,
  type OrderView,
} from "@/lib/checkout";
import { ReorderButton } from "@/components/account/OrdersList";

const POLL_MS = 3_000;
const POLL_FOR_MS = 90_000;

type Props = {
  order: OrderView;
  currency: CurrencyConfig;
  brandName: string;
  phone?: string;
  context?: "checkout" | "account";
  canReorder?: boolean;
};

export function OrderReceipt({
  order,
  currency,
  brandName,
  phone,
  context = "checkout",
  canReorder = false,
}: Props) {
  const inAccount = context === "account";
  const router = useRouter();
  const queryClient = useQueryClient();
  const money = (n: number) => formatMoney(n, currency);

  const waiting =
    order.status === "awaiting_payment" && order.payment.status !== "failed";
  const failed =
    order.status === "awaiting_payment" && order.payment.status === "failed";
  const cancelled = order.status === "cancelled";

  useEffect(() => {
    if (!inAccount && !waiting && !failed)
      void queryClient.invalidateQueries({ queryKey: CART_KEY });
  }, [inAccount, waiting, failed, queryClient]);

  useEffect(() => {
    if (failed || cancelled || order.status === "completed") return;
    const started = Date.now();
    const timer = setInterval(
      () => {
        if (waiting && Date.now() - started > POLL_FOR_MS)
          return clearInterval(timer);
        router.refresh();
      },
      waiting ? POLL_MS : 30_000,
    );
    return () => clearInterval(timer);
  }, [waiting, failed, cancelled, order.status, router]);

  const tz = order.schedule.timezone;
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  const day = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(iso));
  const delivery = order.type === "delivery";

  if (waiting || failed || (cancelled && !inAccount)) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-card px-6 py-12 text-center sm:px-10">
          <span
            className={cn(
              "mx-auto grid size-16 place-items-center rounded-full",
              waiting
                ? "bg-primary/12 text-primary"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {waiting ? (
              <Loader2 className="size-7 animate-spin" />
            ) : (
              <XCircle className="size-8" />
            )}
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            {waiting
              ? "Confirming your payment…"
              : failed
                ? "Your payment didn't go through"
                : "This order was cancelled"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-pretty text-foreground/65">
            {waiting
              ? "Your bank is confirming the payment. This page updates by itself, it usually takes a few seconds."
              : failed
                ? (order.payment.lastError ?? "The card was declined.") +
                  " You weren't charged, and your cart is still here."
                : order.payment.status === "paid" ||
                    order.payment.status === "refunded"
                  ? "Your card payment is being refunded. Sorry about that! Call us if you have any questions."
                  : "Nothing was charged. Your dishes are still in your cart if you'd like to order again."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {waiting ? (
              <button
                type="button"
                onClick={() => router.refresh()}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-foreground/15 px-5 font-semibold"
              >
                <RotateCw className="size-4" /> Check again
              </button>
            ) : (
              <Link
                href={CHECKOUT_ROUTE}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground"
              >
                <RotateCw className="size-4" /> Try again
              </Link>
            )}
            <Link
              href="/menu"
              className="inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold text-foreground/70 hover:text-foreground"
            >
              Back to the menu
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const steps = STATUS_STEPS[order.type];
  const current = Math.max(
    0,
    steps.findIndex((s) => s.status === order.status),
  );
  const at = (status: string) =>
    order.history.findLast((h) => h.status === status)?.at;
  const eta = order.schedule.asap
    ? `${time(order.schedule.from)} – ${time(order.schedule.to)}`
    : time(order.schedule.from);
  const a = order.amounts;
  const total = money(a.total);

  const address = order.address
    ? [
        order.address.street,
        order.address.building && `Bldg ${order.address.building}`,
        order.address.floor && `Floor ${order.address.floor}`,
        order.address.apartment && `Apt ${order.address.apartment}`,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <Shell>
      {inAccount && (
        <Link
          href={ORDERS_ROUTE}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All orders
        </Link>
      )}

      {inAccount ? (
        <AccountHero
          order={order}
          eta={eta}
          day={day}
          time={time}
          total={total.main}
        />
      ) : (
        <section className="relative overflow-hidden rounded-[calc(var(--radius)*2.5)] bg-primary px-6 py-10 text-primary-foreground sm:px-10 sm:py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -left-16 size-64 rounded-full bg-black/10 blur-2xl"
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="grid size-14 place-items-center rounded-full bg-primary-foreground text-primary shadow-lg transition-transform duration-500 starting:scale-50 starting:rotate-[-30deg]">
                <Check className="size-7" strokeWidth={3} />
              </span>
              <p className="mt-5 text-sm font-semibold tracking-[0.14em] uppercase opacity-80">
                Order #{order.number}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {order.schedule.asap
                  ? `Thank you, ${order.customer.name.split(" ")[0]}!`
                  : "You're all set!"}
              </h1>
              <p className="mt-2 max-w-md opacity-85">
                A confirmation is on its way to {order.customer.email}.
              </p>
            </div>
            <div className="rounded-2xl bg-black/15 px-5 py-4 backdrop-blur-sm sm:text-right">
              <p className="text-sm opacity-80">
                {order.schedule.asap
                  ? delivery
                    ? "Arriving around"
                    : "Ready around"
                  : delivery
                    ? `Delivery on ${day(order.schedule.from)}`
                    : `Pickup on ${day(order.schedule.from)}`}
              </p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {eta}
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-6">
          <Card title="Order status">
            {cancelled ? (
              <p className="flex items-center gap-3 text-foreground/70">
                <XCircle className="size-6 text-destructive" />
                Cancelled
                {at("cancelled")
                  ? ` at ${time(at("cancelled")!)}, ${day(at("cancelled")!)}`
                  : ""}
              </p>
            ) : (
              <ol className="relative">
                {steps.map((step, i) => {
                  const done = i <= current;
                  const when = at(step.status);
                  return (
                    <li
                      key={step.status}
                      className="relative flex gap-4 pb-6 last:pb-0"
                    >
                      {i < steps.length - 1 && (
                        <span
                          className={cn(
                            "absolute top-8 left-3.75 h-[calc(100%-2rem)] w-0.5",
                            i < current ? "bg-primary" : "bg-foreground/10",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "relative grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                          done
                            ? "bg-primary text-white"
                            : "bg-foreground/[0.07] text-foreground/40",
                          i === current && "ring-4 ring-primary/20",
                        )}
                      >
                        {done ? (
                          <Check className="size-4" strokeWidth={3} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <div className="pt-1">
                        <p
                          className={cn(
                            "font-medium",
                            !done && "text-foreground/45",
                          )}
                        >
                          {step.label}
                        </p>
                        {done && when && (
                          <p className="text-sm text-foreground/55">
                            {time(when)}
                          </p>
                        )}
                        {i === current && i < steps.length - 1 && (
                          <p className="text-sm text-primary">
                            We&apos;ll update this page as it moves along
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Info
              icon={
                delivery ? (
                  <Bike className="size-5" />
                ) : (
                  <Store className="size-5" />
                )
              }
              title={delivery ? "Delivery to" : "Pickup at"}
            >
              {delivery ? (
                <>
                  <p className="font-medium">{address}</p>
                  {order.address?.area && (
                    <p className="text-foreground/60">{order.address.area}</p>
                  )}
                  {order.address?.directions && (
                    <p className="mt-1 text-sm text-foreground/55">
                      “{order.address.directions}”
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-medium">{brandName}</p>
                  {order.pickupAddress && (
                    <p className="text-foreground/60">{order.pickupAddress}</p>
                  )}
                </>
              )}
            </Info>
            <Info
              icon={
                order.payment.method === "card" ? (
                  <CreditCard className="size-5" />
                ) : (
                  <Banknote className="size-5" />
                )
              }
              title="Payment"
            >
              {order.payment.method === "card" ? (
                <>
                  <p className="font-medium capitalize">
                    {order.payment.cardBrand ?? "Card"}{" "}
                    {order.payment.cardLast4 && (
                      <span className="tabular-nums">
                        •••• {order.payment.cardLast4}
                      </span>
                    )}
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400">
                    {order.payment.status === "paid"
                      ? `Paid ${total.main}`
                      : "Processing"}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">
                    {delivery ? "Cash on delivery" : "Pay at pickup"}
                  </p>
                  <p className="text-foreground/60">
                    {total.main} to pay
                    {order.payment.cashChangeFor
                      ? ` · change for ${money(order.payment.cashChangeFor).main}`
                      : ""}
                  </p>
                </>
              )}
            </Info>
            <Info
              icon={
                order.schedule.asap ? (
                  <Clock className="size-5" />
                ) : (
                  <CalendarClock className="size-5" />
                )
              }
              title="When"
            >
              <p className="font-medium">
                {order.schedule.asap
                  ? "As soon as possible"
                  : `${day(order.schedule.from)}`}
              </p>
              <p className="text-foreground/60 tabular-nums">{eta}</p>
            </Info>
            <Info icon={<Phone className="size-5" />} title="Contact">
              <p className="font-medium tabular-nums">{order.customer.phone}</p>
              {phone && (
                <p className="text-sm text-foreground/60">
                  Questions? Call us on{" "}
                  <a
                    href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                    className="whitespace-nowrap font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {phone}
                  </a>
                </p>
              )}
            </Info>
          </div>
        </div>

        <Card
          title={`${order.lines.reduce((n, l) => n + l.quantity, 0)} items`}
        >
          <ul className="divide-y divide-foreground/10">
            {order.lines.map((line, i) => {
              const src = mediaSrc(line.image);
              const details = [
                line.variantName,
                ...line.options.map((o) => o.split(": ").pop()),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={i} className="flex gap-3 py-3 first:pt-0">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-foreground/6">
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="48px"
                        unoptimized={!canOptimize(src)}
                        className="object-cover"
                      />
                    ) : (
                      <UtensilsCrossed className="absolute inset-0 m-auto size-5 text-foreground/30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug font-medium">
                      <span className="text-foreground/50 tabular-nums">
                        {line.quantity}×
                      </span>{" "}
                      {line.name}
                    </p>
                    {details && (
                      <p className="text-xs text-foreground/55">{details}</p>
                    )}
                    {line.note && (
                      <p className="text-xs text-foreground/55 italic">
                        “{line.note}”
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {money(line.total).main}
                  </p>
                </li>
              );
            })}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-foreground/10 pt-4 text-[15px]">
            <Row label="Subtotal" value={money(a.subtotal).main} />
            {a.savings > 0 && (
              <Row
                label="You saved"
                value={`−${money(a.savings).main}`}
                className="text-emerald-700 dark:text-emerald-400"
              />
            )}
            {delivery && (
              <Row
                label="Delivery"
                value={a.deliveryFee > 0 ? money(a.deliveryFee).main : "Free"}
              />
            )}
            {a.tip > 0 && <Row label="Tip" value={money(a.tip).main} />}
            {a.vat > 0 && !a.vatIncluded && (
              <Row
                label={`VAT (${Math.round(a.vatRate * 100)}%)`}
                value={money(a.vat).main}
              />
            )}
            <div className="flex items-baseline justify-between border-t border-foreground/10 pt-3">
              <dt className="font-semibold">Total</dt>
              <dd className="text-right tabular-nums">
                <span className="text-xl font-semibold">{total.main}</span>
                {total.sub && (
                  <span className="block text-xs text-foreground/55">
                    ≈ {total.sub}
                  </span>
                )}
              </dd>
            </div>
            {a.vat > 0 && a.vatIncluded && (
              <div className="text-right text-xs text-foreground/50">
                Includes {money(a.vat).main} VAT
              </div>
            )}
          </dl>
          {order.notes && (
            <p className="mt-4 rounded-xl bg-muted/70 px-3.5 py-3 text-sm text-foreground/70">
              <span className="font-semibold text-foreground">Your note:</span>{" "}
              {order.notes}
            </p>
          )}
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {inAccount && canReorder && <ReorderButton orderId={order.id} />}
        <Link
          href={inAccount ? ORDERS_ROUTE : "/menu"}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-foreground/15 px-5 font-semibold transition-colors hover:bg-foreground/4"
        >
          <ArrowLeft className="size-4" />{" "}
          {inAccount ? "All orders" : "Back to the menu"}
        </Link>
        {!inAccount && (
          <Link
            href={ORDERS_ROUTE}
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold text-foreground/70 hover:text-foreground"
          >
            Your orders
          </Link>
        )}
        {delivery && order.address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, order.address.area].filter(Boolean).join(", "))}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold text-foreground/70 hover:text-foreground"
          >
            <MapPin className="size-4" /> See the address on a map
          </a>
        )}
      </div>
    </Shell>
  );
}

function AccountHero({
  order,
  eta,
  day,
  time,
  total,
}: {
  order: OrderView;
  eta: string;
  day: (iso: string) => string;
  time: (iso: string) => string;
  total: string;
}) {
  const active = isActiveOrder(order.status);
  const cancelled = order.status === "cancelled";
  const delivery = order.type === "delivery";
  const doneAt = order.history.findLast((h) => h.status === "completed")?.at;
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[calc(var(--radius)*2.5)] px-6 py-8 sm:px-10 sm:py-10",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-foreground/10 bg-card",
      )}
    >
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-white/10 blur-2xl"
        />
      )}
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span
            className={cn(
              "grid size-12 place-items-center rounded-full",
              active
                ? "bg-primary-foreground text-primary"
                : cancelled
                  ? "bg-destructive/10 text-destructive"
                  : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
            )}
          >
            {cancelled ? (
              <XCircle className="size-6" />
            ) : active ? (
              delivery ? (
                <Bike className="size-6" />
              ) : (
                <Store className="size-6" />
              )
            ) : (
              <Check className="size-6" strokeWidth={3} />
            )}
          </span>
          <p
            className={cn(
              "mt-4 text-sm font-semibold tracking-[0.14em] uppercase",
              active ? "opacity-80" : "text-foreground/50",
            )}
          >
            Order #{order.number} · {delivery ? "Delivery" : "Pickup"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {statusLabel(order)}
          </h1>
          <p
            className={cn(
              "mt-1.5",
              active ? "opacity-85" : "text-foreground/60",
            )}
          >
            Placed {day(order.createdAt)} at {time(order.createdAt)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-2xl px-5 py-4 sm:text-right",
            active ? "bg-black/15 backdrop-blur-sm" : "bg-muted/70",
          )}
        >
          <p
            className={cn(
              "text-sm",
              active ? "opacity-80" : "text-foreground/55",
            )}
          >
            {active
              ? order.schedule.asap
                ? delivery
                  ? "Arriving around"
                  : "Ready around"
                : `Scheduled · ${day(order.schedule.from)}`
              : cancelled
                ? "Total"
                : delivery
                  ? "Delivered"
                  : "Picked up"}
          </p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
            {active ? eta : cancelled ? total : doneAt ? time(doneAt) : total}
          </p>
        </div>
      </div>
    </section>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-svh bg-background pb-24 text-foreground [--pad:clamp(1rem,4vw,3rem)]">
      <div className="mx-auto max-w-5xl px-(--pad) pt-[calc(var(--nav-height,4.5rem)+2rem)]">
        {children}
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-card p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Info({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card p-5">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground/55">
        <span className="text-primary">{icon}</span> {title}
      </p>
      <div className="text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <dt className="text-foreground/70">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
