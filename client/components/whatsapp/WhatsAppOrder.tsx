"use client";

import Image from "next/image";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  Bike,
  ChevronRight,
  MessageCircle,
  Minus,
  Plus,
  Sparkles,
  Store,
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
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { canOptimize, mediaSrc } from "@/admin/lib/menu/format";
import { formatMoney, type CurrencyConfig } from "@/lib/menu/money";
import {
  CART_TARGET,
  MAX_LINE_QUANTITY,
  onCartBump,
  requestSignIn,
  type AddToCartInput,
} from "@/lib/cart";
import type { PublicDish } from "@/lib/menu/public-menu";
import {
  guestListMessage,
  listSavings,
  whatsappLink,
  type ListDetails,
  type ListLine,
} from "@/lib/whatsapp";
import { useAddToCart } from "@/components/cart/use-cart";
import { WA_BUTTON } from "./Whatsapp";

export type WhatsAppOrderSettings = {
  number: string;
  brandName: string;
  currency: CurrencyConfig;
  online: boolean;
  delivery: boolean;
  pickup: boolean;
};

const SettingsContext = createContext<WhatsAppOrderSettings | null>(null);

type Line = ListLine & { key: string; image?: string; imageBlur?: string };
type Saved = { lines: Line[]; details: ListDetails };

const STORE_KEY = "mesa:whatsapp-order";
const EMPTY: Saved = {
  lines: [],
  details: { name: "", type: null, address: "", when: "", notes: "" },
};

let saved: Saved = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<Saved>;
      saved = {
        lines: Array.isArray(data.lines) ? data.lines : [],
        details: { ...EMPTY.details, ...data.details },
      };
    }
  } catch {
    // private window or blocked storage: the list just lives in memory
  }
}

function update(change: (s: Saved) => Saved) {
  load();
  saved = change(saved);
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(saved));
  } catch {
    // same as above
  }
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  load();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORE_KEY) return;
    loaded = false;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};
const snapshot = () => {
  load();
  return saved;
};
const serverSnapshot = () => EMPTY;

const useSaved = () =>
  useSyncExternalStore(subscribe, snapshot, serverSnapshot);

const total = (lines: Line[]) =>
  Math.round(
    lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0) * 100,
  ) / 100;

/* ───────────── adding from the menu ───────────── */

export type MenuAddInput = AddToCartInput & { name: string; dish: PublicDish };

function toLine(input: MenuAddInput): Line {
  const { dish } = input;
  const variant = dish.variants.find((v) => v.id === input.variantId);
  const base = variant
    ? (variant.salePrice ?? variant.price)
    : (dish.salePrice ?? dish.price);
  const full = variant ? variant.price : dish.price;
  const options = dish.modifierGroups
    .flatMap((g) => g.options)
    .filter((o) => input.optionIds.includes(o.id));
  const extras = options.reduce((sum, o) => sum + (o.priceDelta ?? 0), 0);
  const note = input.note?.trim() || undefined;
  // On sale right now (a promotion): keep the full price and the sale's name for the message
  const onSale = full > base;
  return {
    key: [
      dish.id,
      variant?.id ?? "",
      [...input.optionIds].sort().join(","),
      note ?? "",
    ].join("|"),
    name: dish.name,
    variant: variant?.name,
    options: options.map((o) => o.name),
    note,
    quantity: input.quantity,
    unitPrice: base + extras,
    unitWas: onSale ? full + extras : undefined,
    sale:
      onSale && dish.sale
        ? { name: dish.sale.name, percentOff: dish.sale.percentOff }
        : undefined,
    image: dish.image,
    imageBlur: dish.imageBlur,
  };
}

function addLine(input: MenuAddInput) {
  const line = toLine(input);
  update((s) => {
    const same = s.lines.find((l) => l.key === line.key);
    const lines = same
      ? s.lines.map((l) =>
          l.key === line.key
            ? {
                ...l,
                quantity: Math.min(
                  MAX_LINE_QUANTITY,
                  l.quantity + line.quantity,
                ),
                unitPrice: line.unitPrice,
                unitWas: line.unitWas,
                sale: line.sale,
              }
            : l,
        )
      : [...s.lines, line];
    return { ...s, lines };
  });
}

/**
 * The menu's "Add". Without <WhatsAppOrder> around the menu it is exactly useAddToCart().
 * With it: online ordering on → the real cart, or the WhatsApp list when signed out;
 * online ordering off → always the WhatsApp list.
 */
export function useMenuAdd({ onAdded }: { onAdded?: () => void } = {}) {
  const settings = useContext(SettingsContext);

  const addLocally = (input: MenuAddInput) => {
    addLine(input);
    onAdded?.();
    toast.add({
      title: `${input.quantity > 1 ? `${input.quantity} × ` : ""}${input.name} added to your WhatsApp order`,
      description: settings?.online
        ? "Or sign in to order and pay online."
        : undefined,
      type: "success",
    });
  };

  const cart = useAddToCart({
    onAdded: () => onAdded?.(),
    onSignedOut: settings
      ? (input) => {
          addLocally(input as MenuAddInput);
          return true;
        }
      : undefined,
  });

  return {
    isPending: cart.isPending,
    variables: cart.variables as MenuAddInput | undefined,
    mutate(input: MenuAddInput, options?: { onSuccess?: () => void }) {
      if (settings && !settings.online) {
        addLocally(input);
        options?.onSuccess?.();
        return;
      }
      cart.mutate(input, { onSuccess: () => options?.onSuccess?.() });
    },
  };
}

/* ───────────── the bar and the sheet ───────────── */

export function WhatsAppOrder({
  settings,
  children,
}: {
  settings: WhatsAppOrderSettings;
  children: ReactNode;
}) {
  return (
    <SettingsContext.Provider value={settings}>
      {children}
      <OrderBar settings={settings} />
    </SettingsContext.Provider>
  );
}

function OrderBar({ settings }: { settings: WhatsAppOrderSettings }) {
  const { lines } = useSaved();
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const money = (n: number) => formatMoney(n, settings.currency).main;

  useEffect(() => onCartBump(() => setBump((b) => b + 1)), []);
  // The last dish removed closes the sheet (worked out, not stored)
  const sheetOpen = open && count > 0;

  return (
    <>
      {count > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            key={bump}
            type="button"
            {...{ [CART_TARGET]: "" }}
            onClick={() => setOpen(true)}
            className={cn(
              "pointer-events-auto flex h-14 w-full max-w-md items-center gap-3 rounded-full pr-3 pl-2 shadow-[0_18px_40px_-14px_rgb(0_0_0/0.5)] transition duration-300 starting:translate-y-6 starting:opacity-0",
              bump > 0 && "animate-[wa-bump_0.45s_ease-out]",
              WA_BUTTON,
            )}
          >
            <span className="relative grid size-10 place-items-center rounded-full bg-white/15">
              <MessageCircle className="size-5" />
              <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-[#128C4A] tabular-nums">
                {count}
              </span>
            </span>
            <span className="flex-1 text-left leading-tight">
              <span className="block font-semibold">Your WhatsApp order</span>
              <span className="block text-sm opacity-85">Review and send</span>
            </span>
            <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
              {money(total(lines))}
              <ChevronRight className="size-5" />
            </span>
          </button>
          <style>{`@keyframes wa-bump{0%{transform:scale(1)}35%{transform:scale(1.04,0.94)}65%{transform:scale(0.98,1.03)}100%{transform:scale(1)}}`}</style>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-115"
        >
          <SheetHeader className="border-b border-foreground/10 px-5 py-4 text-left sm:px-6">
            <SheetTitle className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full",
                  WA_BUTTON,
                )}
              >
                <MessageCircle className="size-4" />
              </span>
              Order on WhatsApp
            </SheetTitle>
            <SheetDescription>
              Check your order, then send it to {settings.brandName}. They
              confirm it with you in the chat.
            </SheetDescription>
          </SheetHeader>
          {sheetOpen && (
            <OrderSheet settings={settings} onClose={() => setOpen(false)} />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function OrderSheet({
  settings,
  onClose,
}: {
  settings: WhatsAppOrderSettings;
  onClose: () => void;
}) {
  const { lines, details } = useSaved();
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState(false);
  const money = (n: number) => formatMoney(n, settings.currency).main;
  const subtotal = total(lines);
  const saved = listSavings(lines);

  const types = [
    settings.delivery && "delivery",
    settings.pickup && "pickup",
  ].filter(Boolean) as ("delivery" | "pickup")[];
  const type =
    details.type && types.includes(details.type)
      ? details.type
      : (types[0] ?? null);
  const set = (patch: Partial<ListDetails>) =>
    update((s) => ({ ...s, details: { ...s.details, ...patch } }));
  const setQuantity = (key: string, quantity: number) =>
    update((s) => ({
      ...s,
      lines:
        quantity <= 0
          ? s.lines.filter((l) => l.key !== key)
          : s.lines.map((l) => (l.key === key ? { ...l, quantity } : l)),
    }));

  const missingAddress =
    type === "delivery" && details.address.trim().length < 6;
  const message = useMemo(
    () =>
      guestListMessage(
        settings.brandName,
        lines,
        { ...details, type },
        money,
        subtotal,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, details, type, settings.brandName, subtotal],
  );

  if (sent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16 text-center">
        <span
          className={cn(
            "grid size-20 place-items-center rounded-full",
            WA_BUTTON,
          )}
        >
          <MessageCircle className="size-9" />
        </span>
        <p className="mt-6 text-xl font-semibold tracking-tight">
          Did you press Send?
        </p>
        <p className="mt-1.5 max-w-xs text-pretty text-foreground/60">
          Your order is typed in WhatsApp. Once it&apos;s sent,{" "}
          {settings.brandName} confirms it and the total with you there.
        </p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              update((s) => ({ ...s, lines: [] }));
              onClose();
              toast.add({
                title: "Thanks! Your list is cleared",
                type: "success",
              });
            }}
            className="h-12 rounded-full bg-foreground px-6 font-semibold text-background transition-opacity hover:opacity-90"
          >
            Sent, clear my list
          </button>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="h-12 rounded-full px-6 font-semibold text-foreground/70 hover:text-foreground"
          >
            Not yet, go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ul className="divide-y divide-foreground/10 px-5 sm:px-6">
          {lines.map((line) => (
            <ListItem
              key={line.key}
              line={line}
              money={money}
              onQuantity={(q) => setQuantity(line.key, q)}
            />
          ))}
        </ul>

        <div className="space-y-4 border-t border-foreground/10 px-5 py-5 sm:px-6">
          {types.length > 1 && (
            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Delivery or pickup"
            >
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => set({ type: t })}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-2xl border font-semibold transition-colors",
                    type === t
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/15 hover:bg-foreground/5",
                  )}
                >
                  {t === "delivery" ? (
                    <Bike className="size-4.5" />
                  ) : (
                    <Store className="size-4.5" />
                  )}
                  {t === "delivery" ? "Delivery" : "Pickup"}
                </button>
              ))}
            </div>
          )}
          {type === "delivery" && (
            <Field
              label="Delivery address"
              error={
                tried && missingAddress
                  ? "Add your address so the driver finds you"
                  : undefined
              }
            >
              <textarea
                value={details.address}
                onChange={(e) => set({ address: e.target.value })}
                rows={2}
                autoComplete="street-address"
                placeholder="Area, street, building, floor"
                className={INPUT}
                aria-invalid={tried && missingAddress}
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name">
              <input
                value={details.name}
                onChange={(e) => set({ name: e.target.value })}
                autoComplete="name"
                placeholder="Optional"
                className={INPUT}
              />
            </Field>
            <Field label="When">
              <input
                value={details.when}
                onChange={(e) => set({ when: e.target.value })}
                placeholder="As soon as possible"
                className={INPUT}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={details.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={2}
              placeholder="Allergies, cutlery, change for $50…"
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      <SheetFooter className="mt-0 gap-0 border-t border-foreground/10 bg-background px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        {saved > 0 && (
          <div className="mb-1.5 flex items-center justify-between text-[15px] text-emerald-700 dark:text-emerald-400">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-4" /> You save
            </span>
            <span className="font-semibold tabular-nums">−{money(saved)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Subtotal</span>
          <span className="text-xl font-semibold tabular-nums">
            {money(subtotal)}
          </span>
        </div>
        <p className="mt-1 text-xs text-foreground/50">
          Menu prices. {settings.brandName} confirms the total
          {type === "delivery" ? " and delivery fee" : ""} in the chat.
        </p>
        <a
          href={whatsappLink(settings.number, message)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            setTried(true);
            if (missingAddress) {
              e.preventDefault();
              return;
            }
            // WhatsApp opens in a new tab or the app; this tab asks whether it was sent
            window.setTimeout(() => setSent(true), 400);
          }}
          className={cn(
            "group mt-4 flex h-13 items-center justify-between rounded-full px-6 font-semibold shadow-[0_12px_28px_-12px_rgb(18_140_74/0.8)] transition active:scale-[0.99]",
            WA_BUTTON,
          )}
        >
          <span className="inline-flex items-center gap-2">
            <MessageCircle className="size-5" /> Send on WhatsApp
          </span>
          <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
        {settings.online && (
          <button
            type="button"
            onClick={() => {
              onClose();
              requestSignIn();
            }}
            className="mt-2 h-10 text-sm font-semibold text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
          >
            Or sign in to order and pay online
          </button>
        )}
      </SheetFooter>
    </>
  );
}

function ListItem({
  line,
  money,
  onQuantity,
}: {
  line: Line;
  money: (n: number) => string;
  onQuantity: (q: number) => void;
}) {
  const src = mediaSrc(line.image);
  const details = [line.variant, ...line.options].filter(Boolean).join(" · ");
  return (
    <li className="flex gap-3.5 py-4">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-foreground/6">
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            sizes="128px"
            quality={90}
            placeholder={line.imageBlur ? "blur" : "empty"}
            blurDataURL={line.imageBlur}
            unoptimized={!canOptimize(src)}
            className="object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-foreground/30">
            <UtensilsCrossed className="size-5" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <p className="leading-snug font-semibold">{line.name}</p>
          <p className="shrink-0 text-right leading-snug tabular-nums">
            <span
              className={cn(
                "font-semibold",
                line.unitWas !== undefined && "text-primary",
              )}
            >
              {money(line.unitPrice * line.quantity)}
            </span>
            {line.unitWas !== undefined && (
              <span className="block text-xs text-foreground/45 line-through">
                {money(line.unitWas * line.quantity)}
              </span>
            )}
          </p>
        </div>
        {line.sale && (
          <span className="mt-1 inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {line.sale.name} −{line.sale.percentOff}%
          </span>
        )}
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
        <div className="mt-auto flex items-center pt-2">
          <div className="flex items-center rounded-full border border-foreground/15 bg-background">
            <button
              type="button"
              onClick={() => onQuantity(line.quantity - 1)}
              aria-label={
                line.quantity === 1
                  ? `Remove ${line.name}`
                  : `One less ${line.name}`
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
              aria-label={`One more ${line.name}`}
              className="grid size-8 place-items-center rounded-full transition hover:bg-foreground/[0.07] disabled:opacity-35"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

const INPUT =
  "w-full rounded-xl border border-foreground/15 bg-background px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-foreground/35 focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-primary/20 aria-[invalid=true]:border-destructive";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {error && (
        <span className="mt-1 block text-sm text-destructive">{error}</span>
      )}
    </label>
  );
}
