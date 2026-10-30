"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Minus,
  Plus,
  RotateCw,
  ShoppingBag,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { canOptimize, mediaSrc } from "@/admin/lib/menu/format";
import { formatMoney, type CurrencyConfig } from "@/lib/menu/money";
import {
  CART_TARGET,
  CHECKOUT_ROUTE,
  MAX_LINE_QUANTITY,
  onCartBump,
  type Cart,
  type CartLine,
} from "@/lib/cart";
import { useCart, useCartChanges } from "./use-cart";

type Props = {
  currency: CurrencyConfig;
  pricingNote?: string;
  className?: string;
};

export function CartButton({ currency, pricingNote, className }: Props) {
  const [open, setOpen] = useState(false);
  const cart = useCart();
  const count = cart.data?.count ?? 0;
  const button = useRef<HTMLButtonElement>(null);

  useEffect(
    () =>
      onCartBump(() => {
        button.current?.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.22, 0.86)" },
            { transform: "scale(0.92, 1.1)" },
            { transform: "scale(1)" },
          ],
          { duration: 420, easing: "ease-out" },
        );
      }),
    [],
  );

  const openSheet = () => {
    setOpen(true);
    if (cart.isStale) void cart.refetch();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={openSheet}
        {...{ [CART_TARGET]: "" }}
        aria-label={
          count
            ? `Your order, ${count} ${count === 1 ? "dish" : "dishes"}`
            : "Your order"
        }
        className={cn(
          "relative grid size-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-foreground/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          className,
        )}
      >
        <ShoppingBag className="size-5.25" strokeWidth={1.9} />
        {count > 0 && (
          <span
            key={count}
            className="absolute -top-0.5 -right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[11px] leading-none font-semibold text-white tabular-nums ring-2 ring-primary/40 backdrop-blur-md transition duration-300 starting:scale-50"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-110"
        >
          <SheetHeader className="border-b border-foreground/10 px-5 py-4 text-left sm:px-6">
            <SheetTitle className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
              Your order
              {count > 0 && (
                <span className="rounded-full bg-foreground/[0.07] px-2 py-0.5 text-sm font-semibold text-foreground/70 tabular-nums">
                  {count}
                </span>
              )}
            </SheetTitle>
            <SheetDescription className="sr-only">
              The dishes you picked, their prices and the way to checkout.
            </SheetDescription>
          </SheetHeader>

          {cart.isPending ? (
            <LoadingLines />
          ) : cart.isError ? (
            <Problem
              message={cart.error.message}
              onRetry={() => void cart.refetch()}
            />
          ) : cart.data.lines.length === 0 ? (
            <Empty onBrowse={() => setOpen(false)} />
          ) : (
            <Order
              cart={cart.data}
              currency={currency}
              pricingNote={pricingNote}
              onCheckout={() => setOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Order({
  cart,
  currency,
  pricingNote,
  onCheckout,
}: {
  cart: Cart;
  currency: CurrencyConfig;
  pricingNote?: string;
  onCheckout: () => void;
}) {
  const { quantity, remove, clear } = useCartChanges();
  const [confirmClear, setConfirmClear] = useState(false);
  const money = (n: number) => formatMoney(n, currency);
  const subtotal = money(cart.subtotal);
  const issues = cart.lines.filter((l) => l.issue).length;

  useEffect(() => {
    if (!confirmClear) return;
    const id = window.setTimeout(() => setConfirmClear(false), 3500);
    return () => window.clearTimeout(id);
  }, [confirmClear]);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {issues > 0 && (
          <p className="mx-5 mt-4 flex items-start gap-2.5 rounded-xl bg-amber-500/12 px-3.5 py-3 text-sm text-amber-900 sm:mx-6 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {issues === 1
              ? "One dish can't be ordered right now."
              : `${issues} dishes can't be ordered right now.`}{" "}
            Remove {issues === 1 ? "it" : "them"} to check out.
          </p>
        )}
        <ul className="divide-y divide-foreground/10 px-5 sm:px-6">
          {cart.lines.map((line) => (
            <Line
              key={line.id}
              line={line}
              money={money}
              onQuantity={(q) =>
                quantity.mutate({ lineId: line.id, quantity: q })
              }
              onRemove={() => remove.mutate(line.id)}
            />
          ))}
        </ul>
        <div className="flex items-center justify-between px-5 pt-1 pb-5 sm:px-6">
          <Link
            href="/menu"
            onClick={onCheckout}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            + Add more dishes
          </Link>
          <button
            type="button"
            onClick={() => {
              if (!confirmClear) return setConfirmClear(true);
              setConfirmClear(false);
              clear.mutate();
            }}
            className={cn(
              "text-sm font-medium transition-colors",
              confirmClear
                ? "text-destructive"
                : "text-foreground/50 hover:text-foreground",
            )}
          >
            {confirmClear ? "Tap again to clear" : "Clear order"}
          </button>
        </div>
      </div>

      <SheetFooter className="mt-0 gap-0 border-t border-foreground/10 bg-background px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <dl className="space-y-1.5 text-[15px]">
          {cart.savings > 0 && (
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
              <dt className="inline-flex items-center gap-1.5">
                <Sparkles className="size-4" /> You save
              </dt>
              <dd className="font-semibold tabular-nums">
                −{money(cart.savings).main}
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <dt className="font-semibold">Subtotal</dt>
            <dd className="text-right tabular-nums">
              <span className="text-xl font-semibold">{subtotal.main}</span>
              {subtotal.sub && (
                <span className="block text-xs text-foreground/55">
                  {subtotal.sub}
                </span>
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-1 text-xs text-foreground/50">
          {pricingNote ? `${pricingNote} ` : ""}Any fees are added at checkout.
        </p>

        {cart.ready ? (
          <Link
            href={CHECKOUT_ROUTE}
            onClick={onCheckout}
            className="group mt-4 flex h-13 items-center justify-between rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-[0_12px_28px_-12px_color-mix(in_srgb,var(--primary)_85%,transparent)] transition hover:brightness-110 active:scale-[0.99]"
          >
            <span>Checkout</span>
            <span className="inline-flex items-center gap-2 tabular-nums">
              {subtotal.main}
              <ArrowRight className="size-4.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="mt-4 flex h-13 cursor-not-allowed items-center justify-center rounded-full bg-foreground/10 px-6 font-semibold text-foreground/45"
          >
            {issues > 0 ? "Remove unavailable dishes first" : "Checkout"}
          </span>
        )}
      </SheetFooter>
    </>
  );
}

function Line({
  line,
  money,
  onQuantity,
  onRemove,
}: {
  line: CartLine;
  money: (n: number) => { main: string; sub: string | null };
  onQuantity: (q: number) => void;
  onRemove: () => void;
}) {
  const src = mediaSrc(line.dish.image);
  const blocked = !!line.issue;
  const details = [line.variant?.name, ...line.options.map((o) => o.name)]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex gap-3.5 py-4 transition duration-300 starting:-translate-x-2 starting:opacity-0">
      <div
        className={cn(
          "relative size-18 shrink-0 overflow-hidden rounded-xl bg-foreground/6",
          blocked && "opacity-50 grayscale",
        )}
      >
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            sizes="128px"
            quality={90}
            placeholder={line.dish.imageBlur ? "blur" : "empty"}
            blurDataURL={line.dish.imageBlur}
            unoptimized={!canOptimize(src)}
            className="object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-foreground/30">
            <UtensilsCrossed className="size-6" />
          </span>
        )}
        {line.sale && !blocked && (
          <span className="absolute bottom-1 left-1 rounded-full bg-primary px-1.5 py-px text-[10px] font-bold text-primary-foreground tabular-nums">
            −{line.sale.percentOff}%
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              "leading-snug font-semibold",
              blocked && "text-foreground/55",
            )}
          >
            {line.dish.name}
          </p>
          {!blocked && (
            <p className="shrink-0 text-right leading-snug tabular-nums">
              <span
                className={cn(
                  "font-semibold",
                  line.unitWas !== undefined && "text-primary",
                )}
              >
                {money(line.total).main}
              </span>
              {line.unitWas !== undefined && (
                <span className="block text-xs text-foreground/45 line-through">
                  {money(line.unitWas * line.quantity).main}
                </span>
              )}
            </p>
          )}
        </div>
        {details && (
          <p className="mt-0.5 line-clamp-2 text-sm text-foreground/60">
            {details}
          </p>
        )}
        {line.note && (
          <p className="mt-0.5 line-clamp-2 text-sm text-foreground/60 italic">
            “{line.note}”
          </p>
        )}

        {blocked ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-3.5" /> {line.issueText}
            </span>
            <button
              type="button"
              onClick={onRemove}
              className="text-sm font-semibold text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="mt-auto flex items-center justify-between gap-3 pt-2.5">
            <div className="flex items-center rounded-full border border-foreground/15 bg-background">
              <button
                type="button"
                onClick={() =>
                  line.quantity === 1
                    ? onRemove()
                    : onQuantity(line.quantity - 1)
                }
                aria-label={
                  line.quantity === 1
                    ? `Remove ${line.dish.name}`
                    : `One less ${line.dish.name}`
                }
                className={cn(
                  "grid size-8 place-items-center rounded-full transition hover:bg-foreground/[0.07]",
                  line.quantity === 1 && "text-destructive",
                )}
              >
                {line.quantity === 1 ? (
                  <Trash2 className="size-3.5" />
                ) : (
                  <Minus className="size-3.5" />
                )}
              </button>
              <span
                className="w-7 text-center text-sm font-semibold tabular-nums"
                aria-live="polite"
              >
                {line.quantity}
              </span>
              <button
                type="button"
                onClick={() => onQuantity(line.quantity + 1)}
                disabled={line.quantity >= MAX_LINE_QUANTITY}
                aria-label={`One more ${line.dish.name}`}
                className="grid size-8 place-items-center rounded-full transition hover:bg-foreground/[0.07] disabled:opacity-35"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {line.quantity > 1 && (
              <span className="text-xs text-foreground/50 tabular-nums">
                {money(line.unitPrice).main} each
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function Empty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16 text-center">
      <span className="relative grid size-24 place-items-center rounded-full bg-primary/10 text-primary">
        <ShoppingBag className="size-10" strokeWidth={1.6} />
        <span
          aria-hidden
          className="absolute -top-1 -right-1 grid size-8 place-items-center rounded-full bg-background text-lg shadow-sm ring-1 ring-foreground/10"
        >
          +
        </span>
      </span>
      <p className="mt-6 text-xl font-semibold tracking-tight">
        Your order is empty
      </p>
      <p className="mt-1.5 max-w-xs text-pretty text-foreground/60">
        Add dishes from the menu and they&apos;ll wait for you here, on any
        device.
      </p>
      <Link
        href="/menu"
        onClick={onBrowse}
        className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 font-semibold text-background transition-opacity hover:opacity-90"
      >
        Browse the menu <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function LoadingLines() {
  return (
    <ul
      className="flex-1 space-y-5 px-5 py-5 sm:px-6"
      aria-label="Loading your order"
    >
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex animate-pulse gap-3.5">
          <span className="size-18 rounded-xl bg-foreground/[0.07]" />
          <span className="flex-1 space-y-2 pt-1">
            <span className="block h-4 w-2/3 rounded bg-foreground/[0.07]" />
            <span className="block h-3 w-1/2 rounded bg-foreground/6" />
            <span className="block h-8 w-24 rounded-full bg-foreground/6" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Problem({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-foreground/6 text-foreground/60">
        <AlertTriangle className="size-6" />
      </span>
      <p className="mt-4 font-semibold">Your order didn&apos;t load</p>
      <p className="mt-1 max-w-xs text-sm text-pretty text-foreground/60">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-foreground/20 px-4 text-sm font-semibold hover:bg-foreground/5"
      >
        <RotateCw className="size-4" /> Try again
      </button>
    </div>
  );
}
