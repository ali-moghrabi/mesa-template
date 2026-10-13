"use client";

/**
 * One order, in a side panel: what to cook, for whom, where, how it's paid, and what happened.
 *
 *   Everyone (orders:manage)  moves it along (big button), steps back a wrong click, cancels unpaid
 *                             orders, prints the kitchen ticket, writes a team note
 *   Owner (orders:edit)       also changes the dishes (add, remove, quantities, notes), the
 *                             delivery fee and a discount, cancels paid orders and refunds cards
 *
 * Refreshes every 10 seconds (not while editing). Every change sends the order's version, so two
 * people acting at once never overwrite each other.
 */

import Image from "next/image";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Bike,
  CalendarClock,
  Check,
  Copy,
  CreditCard,
  Banknote,
  History,
  Loader2,
  Mail,
  MapPin,
  Minus,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Store,
  Trash2,
  Undo2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { canOptimize, mediaSrc } from "@/admin/lib/menu/format";
import { formatMoney } from "@/lib/menu/money";
import type { PublicDish, PublicMenuCategory } from "@/lib/menu/public-menu";
import type { OrderStatus } from "@/lib/checkout";
import {
  changeOrderStatus,
  editOrderItems,
  fetchOrder,
  refundOrder,
  saveStaffNote,
} from "@/admin/lib/orders.actions";
import {
  BOARD_KEY,
  EVENT_LABELS,
  STATUS_META,
  STEPS,
  actionLabel,
  isFinal,
  orderKey,
  previousStatus,
  statusText,
  type AdminOrder,
  type EditLine,
} from "@/admin/lib/orders";
import type { Shared } from "./OrdersBoard";

export type TimeFormat = "12h" | "24h";

/* ───────────── time helpers (shared with the board) ───────────── */

const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 15_000);
  return () => clearInterval(id);
};
const nowSnapshot = () => Math.floor(Date.now() / 15_000) * 15_000;
const noNow = () => null;

/** The time, refreshed every 15 seconds; null on the server (so nothing mismatches) */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, nowSnapshot, noNow);
}

/** 42 s → "now", 7 min → "7 min", 95 min → "1 h 35" */
export function elapsed(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 1) return "now";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 24
    ? `${h} h ${String(min % 60).padStart(2, "0")}`
    : `${Math.floor(h / 24)} d`;
}

/** "19:35" (or "7:35 PM"), with the day when it isn't today */
export function formatClock(
  iso: string,
  shared: Pick<Shared, "timezone" | "timeFormat">,
  withDay = false,
): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: shared.timezone,
    minute: "2-digit",
    ...(shared.timeFormat === "12h"
      ? { hour: "numeric", hour12: true }
      : { hour: "2-digit", hourCycle: "h23" }),
  }).format(date);
  if (!withDay) return time;
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: shared.timezone }).format(d);
  if (day(date) === day(new Date())) return time;
  return `${new Intl.DateTimeFormat("en-GB", { timeZone: shared.timezone, day: "numeric", month: "short" }).format(date)}, ${time}`;
}

/* ───────────── the panel ───────────── */

type Props = {
  orderId: string | null;
  onClose: () => void;
  canEdit: boolean;
  shared: Shared;
  brandName: string;
  menu: PublicMenuCategory[];
};

type Dialogs = "cancel" | "refund" | null;

export function OrderPanel({
  orderId,
  onClose,
  canEdit,
  shared,
  brandName,
  menu,
}: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<Dialogs>(null);

  const order = useQuery({
    queryKey: orderKey(orderId ?? ""),
    enabled: !!orderId,
    queryFn: async () => {
      const result = await fetchOrder(orderId!);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    refetchInterval: editing ? false : 10_000,
  });

  const applied = (updated: AdminOrder) => {
    queryClient.setQueryData(orderKey(updated.id), updated);
    void queryClient.invalidateQueries({ queryKey: BOARD_KEY });
  };
  const failed = (title: string) => (error: Error) => {
    toast.add({ title, description: error.message, type: "error" });
    void order.refetch();
  };

  const move = useMutation({
    mutationFn: async (input: {
      status: OrderStatus;
      reason?: string;
      refund?: boolean;
    }) => {
      const result = await changeOrderStatus(orderId!, {
        ...input,
        version: order.data!.version,
      });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (updated) => {
      applied(updated);
      setDialog(null);
      toast.add({
        title: `Order #${updated.number}: ${statusText(updated.type, updated.status)}`,
        type: "success",
      });
    },
    onError: failed("The order didn't change"),
  });

  const close = () => {
    setEditing(false);
    setDialog(null);
    onClose();
  };

  const data = order.data;

  return (
    <Sheet open={!!orderId} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        // shadcn's sheet caps the right side at max-w-sm (384px) through data-[side=right]: override both, firmly
        className="flex w-full! max-w-none! flex-col gap-0 p-0 data-[side=right]:w-full! sm:w-[min(720px,92vw)]! sm:max-w-[min(720px,92vw)]! data-[side=right]:sm:max-w-[min(720px,92vw)]!"
      >
        {!data ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <SheetHeader className="sr-only">
              <SheetTitle>Order</SheetTitle>
              <SheetDescription>Loading the order</SheetDescription>
            </SheetHeader>
            {order.isError ? (
              <div>
                <AlertTriangle className="mx-auto size-8 text-destructive" />
                <p className="mt-3 font-medium">{order.error.message}</p>
                <button
                  type="button"
                  onClick={() => void order.refetch()}
                  className="mt-4 h-9 rounded-lg border border-border px-4 text-sm font-medium"
                >
                  Try again
                </button>
              </div>
            ) : (
              <Loader2 className="size-7 animate-spin text-muted-foreground" />
            )}
          </div>
        ) : (
          <>
            <PanelHeader
              order={data}
              shared={shared}
              onPrint={() => printTicket(data, shared, brandName)}
            />

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-5 p-5 sm:p-6">
                <StatusBar order={data} />

                {data.status === "cancelled" && data.cancelReason && (
                  <Notice tone="muted" icon={<Ban className="size-4" />}>
                    Cancelled: {data.cancelReason}
                  </Notice>
                )}
                {data.payment.balance > 0.004 && (
                  <Notice tone="amber" icon={<Banknote className="size-4" />}>
                    The order went up after it was paid: collect{" "}
                    <strong>
                      {formatMoney(data.payment.balance, shared.currency).main}
                    </strong>{" "}
                    on {data.type === "delivery" ? "delivery" : "pickup"}.
                  </Notice>
                )}
                {data.payment.balance < -0.004 && (
                  <Notice tone="amber" icon={<RotateCcw className="size-4" />}>
                    <strong>
                      {formatMoney(-data.payment.balance, shared.currency).main}
                    </strong>{" "}
                    is owed back to the guest.
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setDialog("refund")}
                        className="ml-1 font-semibold underline underline-offset-2"
                      >
                        Refund now
                      </button>
                    )}
                  </Notice>
                )}

                <CustomerCard order={data} shared={shared} />

                {editing ? (
                  <EditItems
                    order={data}
                    shared={shared}
                    menu={menu}
                    onDone={() => setEditing(false)}
                    onSaved={applied}
                  />
                ) : (
                  <ItemsCard
                    order={data}
                    shared={shared}
                    onEdit={
                      canEdit && !isFinal(data.status)
                        ? () => setEditing(true)
                        : undefined
                    }
                  />
                )}

                <PaymentCard
                  order={data}
                  shared={shared}
                  onRefund={
                    canEdit &&
                    data.payment.method === "card" &&
                    (data.payment.amountPaid ?? 0) > data.payment.refunded
                      ? () => setDialog("refund")
                      : undefined
                  }
                />

                {(data.notes || data.cutlery) && (
                  <Card
                    title="From the guest"
                    icon={<NotebookPen className="size-4" />}
                  >
                    {data.notes && (
                      <p className="rounded-lg bg-amber-500/12 px-3 py-2 text-[15px] font-medium text-amber-900 dark:text-amber-200">
                        “{data.notes}”
                      </p>
                    )}
                    <p className="mt-2 text-sm text-muted-foreground">
                      {data.cutlery
                        ? "Wants cutlery and napkins"
                        : "No cutlery needed"}
                    </p>
                  </Card>
                )}

                <StaffNote order={data} onSaved={applied} />
                <Timeline order={data} shared={shared} />
              </div>
            </div>

            {/* Actions */}
            {!isFinal(data.status) && !editing && (
              <ActionBar
                order={data}
                pending={move.isPending}
                onMove={(status) => move.mutate({ status })}
                onCancel={() => setDialog("cancel")}
              />
            )}
          </>
        )}

        {data && dialog === "cancel" && (
          <CancelDialog
            order={data}
            canEdit={canEdit}
            shared={shared}
            pending={move.isPending}
            onClose={() => setDialog(null)}
            onConfirm={(reason, refund) =>
              move.mutate({ status: "cancelled", reason, refund })
            }
          />
        )}
        {data && dialog === "refund" && (
          <RefundDialog
            order={data}
            shared={shared}
            onClose={() => setDialog(null)}
            onSaved={applied}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ───────────── header & status ───────────── */

function PanelHeader({
  order,
  shared,
  onPrint,
}: {
  order: AdminOrder;
  shared: Shared;
  onPrint: () => void;
}) {
  const now = useNow();
  const placed = order.placedAt ?? order.createdAt;
  return (
    <SheetHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
      <div className="flex items-start justify-between gap-3 pr-8">
        <div className="min-w-0">
          <SheetTitle className="flex flex-wrap items-center gap-2.5 text-2xl font-semibold tracking-tight tabular-nums">
            #{order.number}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-normal",
                STATUS_META[order.status].pill,
              )}
            >
              {statusText(order.type, order.status)}
            </span>
          </SheetTitle>
          <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              {order.type === "delivery" ? (
                <Bike className="size-4" />
              ) : (
                <Store className="size-4" />
              )}
              {order.type === "delivery" ? "Delivery" : "Pickup"}
            </span>
            <span>
              Placed {formatClock(placed, shared, true)}
              {now !== null && !isFinal(order.status) && (
                <span className="text-foreground/70">
                  {" "}
                  · {elapsed(now - Date.parse(placed))} ago
                </span>
              )}
            </span>
          </SheetDescription>
        </div>
        <button
          type="button"
          onClick={onPrint}
          title="Print the kitchen ticket"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Printer className="size-4" />{" "}
          <span className="max-sm:sr-only">Print</span>
        </button>
      </div>
      <div
        className={cn(
          "mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
          order.schedule.asap
            ? "bg-muted"
            : "bg-sky-500/12 text-sky-800 dark:text-sky-200",
        )}
      >
        <CalendarClock className="size-4 shrink-0" />
        {order.schedule.asap
          ? `As soon as possible · guest expects it ${formatClock(order.schedule.from, shared)}–${formatClock(order.schedule.to, shared)}`
          : `Scheduled for ${formatClock(order.schedule.from, shared, true)}`}
      </div>
    </SheetHeader>
  );
}

function StatusBar({ order }: { order: AdminOrder }) {
  if (order.status === "cancelled" || order.status === "awaiting_payment")
    return null;
  const steps = STEPS[order.type];
  const current = steps.indexOf(order.status);
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Progress">
      {steps.map((step, i) => (
        <li key={step} className="min-w-0">
          <span
            className={cn(
              "block h-1.5 rounded-full",
              i <= current ? "bg-primary" : "bg-muted",
              i === current && "animate-pulse",
            )}
          />
          <span
            className={cn(
              "mt-1.5 block truncate text-[11px] font-medium",
              i <= current ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {statusText(order.type, step)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ActionBar({
  order,
  pending,
  onMove,
  onCancel,
}: {
  order: AdminOrder;
  pending: boolean;
  onMove: (s: OrderStatus) => void;
  onCancel: () => void;
}) {
  const back = previousStatus(order.type, order.status);
  return (
    // Phones: the main action on its own full-width row, Cancel and Step back side by side below.
    // Wider: one row, main action on the right.
    <div className="grid grid-cols-2 gap-2 border-t border-border bg-background px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:flex sm:items-center sm:px-6 sm:py-3.5">
      {order.next && (
        <button
          type="button"
          onClick={() => onMove(order.next!)}
          disabled={pending}
          className={cn(
            "col-span-2 inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold shadow-sm transition-all hover:brightness-105 disabled:opacity-60 sm:order-last sm:ml-auto sm:h-11",
            order.status === "placed"
              ? "bg-rose-500 text-white"
              : "bg-primary text-primary-foreground",
          )}
        >
          {pending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" />
          ) : (
            <Check className="size-4 shrink-0" />
          )}
          <span className="truncate">
            {actionLabel(order.type, order.next)}
          </span>
          <ArrowRight className="size-4 shrink-0" />
        </button>
      )}
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className={cn(
          "inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-destructive/30 px-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 sm:border-transparent",
          !back && "col-span-2 sm:col-span-1",
        )}
      >
        <Ban className="size-4 shrink-0" /> Cancel order
      </button>
      {back && (
        <button
          type="button"
          onClick={() => onMove(back)}
          disabled={pending}
          title={`Back to "${statusText(order.type, back)}"`}
          className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Undo2 className="size-4 shrink-0" /> Step back
        </button>
      )}
    </div>
  );
}

/* ───────────── cards ───────────── */

function Card({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {icon}
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: "amber" | "muted";
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm",
        tone === "amber"
          ? "bg-amber-500/12 text-amber-900 dark:text-amber-200"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

function CustomerCard({ order }: { order: AdminOrder; shared: Shared }) {
  const a = order.address;
  const line = a
    ? [
        a.street,
        a.building && `Bldg ${a.building}`,
        a.floor && `Floor ${a.floor}`,
        a.apartment && `Apt ${a.apartment}`,
      ]
        .filter(Boolean)
        .join(", ")
    : "";
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast.add({ title: "Copied", type: "success" });
  };
  return (
    <Card title="Guest" icon={<Receipt className="size-4" />}>
      <p className="text-lg font-semibold">{order.customer.name}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={`tel:${order.customer.phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-muted px-3 text-sm font-medium tabular-nums hover:bg-muted/70"
        >
          <Phone className="size-4" /> {order.customer.phone}
        </a>
        <a
          href={`mailto:${order.customer.email}`}
          className="inline-flex h-9 min-w-0 items-center gap-2 rounded-lg bg-muted px-3 text-sm font-medium hover:bg-muted/70"
        >
          <Mail className="size-4 shrink-0" />{" "}
          <span className="truncate">{order.customer.email}</span>
        </a>
      </div>
      {order.type === "delivery" && a && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <p className="flex items-start gap-2 text-[15px] font-medium">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              {line}
              {a.area && (
                <span className="block text-sm font-normal text-muted-foreground">
                  {a.area}
                </span>
              )}
            </span>
          </p>
          {a.directions && (
            <p className="mt-2 text-sm text-muted-foreground">
              “{a.directions}”
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([line, a.area].filter(Boolean).join(", "))}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-muted"
            >
              <MapPin className="size-3.5" /> Open map
            </a>
            <button
              type="button"
              onClick={() =>
                copy(
                  [
                    order.customer.name,
                    order.customer.phone,
                    line,
                    a.area,
                    a.directions,
                  ]
                    .filter(Boolean)
                    .join("\n"),
                )
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-muted"
            >
              <Copy className="size-3.5" /> Copy for the driver
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Thumb({ src }: { src?: string }) {
  const url = mediaSrc(src);
  return (
    <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          sizes="44px"
          unoptimized={!canOptimize(url)}
          className="object-cover"
        />
      ) : (
        <UtensilsCrossed className="absolute inset-0 m-auto size-4 text-muted-foreground" />
      )}
    </span>
  );
}

function ItemsCard({
  order,
  shared,
  onEdit,
}: {
  order: AdminOrder;
  shared: Shared;
  onEdit?: () => void;
}) {
  const money = (n: number) => formatMoney(n, shared.currency).main;
  const count = order.lines.reduce((n, l) => n + l.quantity, 0);
  return (
    <Card
      title={`${count} ${count === 1 ? "item" : "items"}${order.editedAt ? " · changed" : ""}`}
      icon={<UtensilsCrossed className="size-4" />}
      action={
        onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-muted"
          >
            <Pencil className="size-3.5" /> Edit items
          </button>
        )
      }
    >
      <ul className="divide-y divide-border">
        {order.lines.map((line, i) => (
          <li key={i} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
            <Thumb src={line.image} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                <span className="mr-1 inline-grid h-5 min-w-5 place-items-center rounded bg-foreground px-1 text-xs font-bold text-background tabular-nums">
                  {line.quantity}
                </span>{" "}
                {line.name}
                {line.variantName && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {line.variantName}
                  </span>
                )}
              </p>
              {line.options.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {line.options.map((o) => o.split(": ").pop()).join(" · ")}
                </p>
              )}
              {line.note && (
                <p className="mt-1 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-sm font-medium text-amber-900 dark:text-amber-200">
                  “{line.note}”
                </p>
              )}
            </div>
            <div className="text-right text-sm tabular-nums">
              <p className="font-semibold">{money(line.total)}</p>
              <p className="text-xs text-muted-foreground">
                {money(line.unitPrice)} each
              </p>
            </div>
          </li>
        ))}
      </ul>
      <Totals amounts={order.amounts} type={order.type} shared={shared} />
    </Card>
  );
}

function Totals({
  amounts: a,
  type,
  shared,
}: {
  amounts: AdminOrder["amounts"];
  type: AdminOrder["type"];
  shared: Shared;
}) {
  const money = (n: number) => formatMoney(n, shared.currency).main;
  const total = formatMoney(a.total, shared.currency);
  return (
    <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
      <Row label="Subtotal" value={money(a.subtotal)} />
      {a.savings > 0 && (
        <Row label="Promotions" value={`−${money(a.savings)}`} muted />
      )}
      {(a.discount ?? 0) > 0 && (
        <Row
          label="Discount"
          value={`−${money(a.discount!)}`}
          className="text-emerald-700 dark:text-emerald-400"
        />
      )}
      {type === "delivery" && (
        <Row
          label="Delivery"
          value={a.deliveryFee > 0 ? money(a.deliveryFee) : "Free"}
        />
      )}
      {a.tip > 0 && <Row label="Tip" value={money(a.tip)} />}
      {a.vat > 0 && (
        <Row
          label={`VAT ${Math.round(a.vatRate * 100)}%${a.vatIncluded ? " (included)" : ""}`}
          value={money(a.vat)}
          muted={a.vatIncluded}
        />
      )}
      <div className="flex items-baseline justify-between pt-1.5">
        <dt className="font-semibold">Total</dt>
        <dd className="text-right tabular-nums">
          <span className="text-lg font-semibold">{total.main}</span>
          {total.sub && (
            <span className="block text-xs text-muted-foreground">
              ≈ {total.sub}
            </span>
          )}
        </dd>
      </div>
    </dl>
  );
}

function Row({
  label,
  value,
  muted,
  className,
}: {
  label: string;
  value: string;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        muted && "text-muted-foreground",
        className,
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function PaymentCard({
  order,
  shared,
  onRefund,
}: {
  order: AdminOrder;
  shared: Shared;
  onRefund?: () => void;
}) {
  const p = order.payment;
  const money = (n: number) => formatMoney(n, shared.currency).main;
  const card = p.method === "card";
  return (
    <Card
      title="Payment"
      icon={
        card ? (
          <CreditCard className="size-4" />
        ) : (
          <Banknote className="size-4" />
        )
      }
      action={
        onRefund && (
          <button
            type="button"
            onClick={onRefund}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-muted"
          >
            <RotateCcw className="size-3.5" /> Refund
          </button>
        )
      }
    >
      <p className="font-medium capitalize">
        {card
          ? `${p.cardBrand ?? "Card"}${p.cardLast4 ? ` •••• ${p.cardLast4}` : ""}`
          : order.type === "delivery"
            ? "Cash on delivery"
            : "Pay at pickup"}
      </p>
      <p className="text-sm text-muted-foreground">
        {p.status === "paid"
          ? `Paid ${money(p.amountPaid ?? order.amounts.total)}${p.paidAt ? ` at ${formatClock(p.paidAt, shared, true)}` : ""}`
          : p.status === "refunded"
            ? "Fully refunded"
            : card
              ? "Not paid yet"
              : `${money(order.amounts.total)} to collect${p.cashChangeFor ? ` · bring change for ${money(p.cashChangeFor)}` : ""}`}
      </p>
      {p.refunds.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {p.refunds.map((r) => (
            <li
              key={r.id}
              className="flex justify-between gap-3 text-muted-foreground"
            >
              <span>
                Refunded by {r.by}
                {r.reason ? ` · ${r.reason}` : ""}
              </span>
              <span className="tabular-nums">−{money(r.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StaffNote({
  order,
  onSaved,
}: {
  order: AdminOrder;
  onSaved: (o: AdminOrder) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? order.staffNote;
  const save = useMutation({
    mutationFn: async () => {
      const result = await saveStaffNote(order.id, value);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (o) => {
      onSaved(o);
      setDraft(null);
      toast.add({ title: "Team note saved", type: "success" });
    },
    onError: (e: Error) =>
      toast.add({
        title: "The note wasn't saved",
        description: e.message,
        type: "error",
      }),
  });
  const dirty = draft !== null && draft !== order.staffNote;
  return (
    <Card
      title="Team note (only the team sees it)"
      icon={<NotebookPen className="size-4" />}
    >
      <textarea
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="e.g. Guest called: no onions on the kafta"
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      {dirty && (
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="h-8 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-sm font-semibold text-background disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="size-3.5 animate-spin" />}{" "}
            Save note
          </button>
        </div>
      )}
    </Card>
  );
}

function Timeline({ order, shared }: { order: AdminOrder; shared: Shared }) {
  const events = [...order.history].reverse();
  return (
    <Card title="History" icon={<History className="size-4" />}>
      <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-1.25 before:w-px before:bg-border">
        {events.map((e, i) => {
          const meta = STATUS_META[e.status as OrderStatus];
          return (
            <li key={i} className="relative flex gap-3 pl-0">
              <span
                className={cn(
                  "relative mt-1.5 size-2.75 shrink-0 rounded-full ring-4 ring-card",
                  meta?.dot ??
                    (e.status === "refunded" ? "bg-sky-500" : "bg-primary"),
                )}
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex flex-wrap justify-between gap-x-3">
                  <span className="font-medium">
                    {EVENT_LABELS[e.status] ??
                      (meta
                        ? statusText(order.type, e.status as OrderStatus)
                        : e.status)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatClock(e.at, shared, true)}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {e.by
                    ? `by ${e.by}`
                    : e.status === "placed"
                      ? "by the guest"
                      : "automatic"}
                  {e.note && (
                    <span className="block text-foreground/80">{e.note}</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ───────────── cancel & refund ───────────── */

function CancelDialog({
  order,
  canEdit,
  shared,
  pending,
  onClose,
  onConfirm,
}: {
  order: AdminOrder;
  canEdit: boolean;
  shared: Shared;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string, refund: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const paidByCard =
    order.payment.method === "card" &&
    (order.payment.amountPaid ?? 0) - order.payment.refunded > 0;
  const [refund, setRefund] = useState(paidByCard);
  const refundable = (order.payment.amountPaid ?? 0) - order.payment.refunded;
  const blocked = paidByCard && !canEdit;
  const quick = [
    "Guest asked to cancel",
    "Out of stock",
    "Couldn't reach the guest",
    "Outside delivery area",
    "Kitchen closed",
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="text-left sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel order #{order.number}?</DialogTitle>
          <DialogDescription>
            The guest sees it as cancelled. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        {blocked ? (
          <Notice tone="amber" icon={<AlertTriangle className="size-4" />}>
            This order was paid by card, so cancelling it needs a refund. Ask
            the owner to cancel it.
          </Notice>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {quick.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setReason(q)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-xs font-medium",
                    reason === q
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={240}
              placeholder="Why is it cancelled?"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            {paidByCard && (
              <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={refund}
                  onChange={(e) => setRefund(e.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  <span className="font-semibold">
                    Refund {formatMoney(refundable, shared.currency).main} to
                    the card
                  </span>
                  <span className="block text-muted-foreground">
                    Stripe returns it to the guest in 5–10 days.
                  </span>
                </span>
              </label>
            )}
          </div>
        )}
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Keep the order
          </button>
          {!blocked && (
            <button
              type="button"
              onClick={() => onConfirm(reason.trim(), paidByCard && refund)}
              disabled={pending || reason.trim().length < 2}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Cancel
              order
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({
  order,
  shared,
  onClose,
  onSaved,
}: {
  order: AdminOrder;
  shared: Shared;
  onClose: () => void;
  onSaved: (o: AdminOrder) => void;
}) {
  const refundable = Math.max(
    0,
    (order.payment.amountPaid ?? 0) - order.payment.refunded,
  );
  const owed =
    order.payment.balance < 0
      ? Math.min(refundable, -order.payment.balance)
      : refundable;
  const [amount, setAmount] = useState(owed.toFixed(2));
  const [reason, setReason] = useState(
    order.payment.balance < 0 ? "Order changed" : "",
  );
  const value = Number(amount);
  const valid =
    value > 0 && value <= refundable + 0.0001 && reason.trim().length >= 2;

  const refund = useMutation({
    mutationFn: async () => {
      const result = await refundOrder(order.id, value, reason);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (o) => {
      onSaved(o);
      toast.add({
        title: `Refunded ${formatMoney(value, shared.currency).main}`,
        description: "The guest gets it back on their card.",
        type: "success",
      });
      onClose();
    },
    onError: (e: Error) =>
      toast.add({
        title: "The refund didn't go through",
        description: e.message,
        type: "error",
      }),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !refund.isPending && onClose()}
    >
      <DialogContent className="text-left sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refund order #{order.number}</DialogTitle>
          <DialogDescription>
            Up to {formatMoney(refundable, shared.currency).main} can go back to
            the guest&apos;s card.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Amount
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-lg font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setAmount(refundable.toFixed(2))}
              className="h-8 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted"
            >
              Everything
            </button>
            {owed !== refundable && (
              <button
                type="button"
                onClick={() => setAmount(owed.toFixed(2))}
                className="h-8 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted"
              >
                What&apos;s owed ({formatMoney(owed, shared.currency).main})
              </button>
            )}
          </div>
          <label className="block text-sm font-medium">
            Reason
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={240}
              placeholder="e.g. A dish was missing"
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={refund.isPending}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => refund.mutate()}
            disabled={!valid || refund.isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
          >
            {refund.isPending && <Loader2 className="size-4 animate-spin" />}{" "}
            Refund {value > 0 ? formatMoney(value, shared.currency).main : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── editing the dishes (owner) ───────────── */

type DraftLine = {
  key: string;
  /** Kept line (index on the order) or a new dish */
  index?: number;
  itemId?: string;
  variantId?: string;
  optionIds?: string[];
  name: string;
  details: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  note: string;
};

function EditItems({
  order,
  shared,
  menu,
  onDone,
  onSaved,
}: {
  order: AdminOrder;
  shared: Shared;
  menu: PublicMenuCategory[];
  onDone: () => void;
  onSaved: (o: AdminOrder) => void;
}) {
  const money = (n: number) => formatMoney(n, shared.currency).main;
  const [lines, setLines] = useState<DraftLine[]>(() =>
    order.lines.map((l, i) => ({
      key: `old-${i}`,
      index: i,
      name: l.name,
      details: [l.variantName, ...l.options.map((o) => o.split(": ").pop())]
        .filter(Boolean)
        .join(" · "),
      image: l.image,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      note: l.note,
    })),
  );
  const [fee, setFee] = useState(order.amounts.deliveryFee.toFixed(2));
  const [discount, setDiscount] = useState(
    (order.amounts.discount ?? 0).toFixed(2),
  );
  const [reason, setReason] = useState("");
  const [picking, setPicking] = useState(false);

  // The new bill, the same way the API works it out
  const a = order.amounts;
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const deliveryFee =
    order.type === "delivery" ? Math.max(0, Number(fee) || 0) : 0;
  const disc = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const taxable = subtotal - disc + deliveryFee;
  const vat =
    a.vatRate > 0
      ? a.vatIncluded
        ? taxable - taxable / (1 + a.vatRate)
        : taxable * a.vatRate
      : 0;
  const total =
    Math.round((taxable + a.tip + (a.vatIncluded ? 0 : vat)) * 100) / 100;
  const diff = total - a.total;

  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = useMutation({
    mutationFn: async () => {
      const payload: EditLine[] = lines.map((l) =>
        l.index !== undefined
          ? {
              index: l.index,
              quantity: l.quantity,
              note: l.note.trim() || undefined,
            }
          : {
              itemId: l.itemId!,
              variantId: l.variantId,
              optionIds: l.optionIds ?? [],
              quantity: l.quantity,
              note: l.note.trim() || undefined,
            },
      );
      const result = await editOrderItems(order.id, {
        version: order.version,
        lines: payload,
        ...(order.type === "delivery" &&
          Number(fee) !== a.deliveryFee && { deliveryFee: deliveryFee }),
        ...(disc !== (a.discount ?? 0) && { discount: disc }),
        reason: reason.trim(),
      });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (o) => {
      onSaved(o);
      toast.add({
        title: `Order #${o.number} updated`,
        description: `New total ${money(o.amounts.total)}`,
        type: "success",
      });
      onDone();
    },
    onError: (e: Error) =>
      toast.add({
        title: "The order wasn't changed",
        description: e.message,
        type: "error",
      }),
  });

  const paidByCard =
    order.payment.method === "card" && order.payment.status === "paid";

  return (
    <section className="rounded-2xl border-2 border-primary/40 bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Pencil className="size-4 text-primary" /> Editing items
        </h3>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="size-3.5" /> Add dish
        </button>
      </header>

      <ul className="space-y-2.5">
        {lines.map((l) => (
          <li
            key={l.key}
            className={cn(
              "rounded-xl border p-3",
              l.index === undefined
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border",
            )}
          >
            <div className="flex items-start gap-3">
              <Thumb src={l.image} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {l.name}
                  {l.index === undefined && (
                    <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-px text-[10px] font-bold text-emerald-700 uppercase dark:text-emerald-300">
                      Added
                    </span>
                  )}
                </p>
                {l.details && (
                  <p className="text-sm text-muted-foreground">{l.details}</p>
                )}
                <p className="text-xs text-muted-foreground tabular-nums">
                  {money(l.unitPrice)} each
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setLines((ls) => ls.filter((x) => x.key !== l.key))
                }
                aria-label={`Remove ${l.name}`}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() =>
                    update(l.key, { quantity: Math.max(1, l.quantity - 1) })
                  }
                  disabled={l.quantity <= 1}
                  aria-label="One less"
                  className="grid size-8 place-items-center disabled:opacity-30"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-7 text-center text-sm font-semibold tabular-nums">
                  {l.quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    update(l.key, { quantity: Math.min(50, l.quantity + 1) })
                  }
                  aria-label="One more"
                  className="grid size-8 place-items-center"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <input
                value={l.note}
                onChange={(e) => update(l.key, { note: e.target.value })}
                maxLength={140}
                placeholder="Note for the kitchen"
                className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <span className="w-20 text-right text-sm font-semibold tabular-nums">
                {money(l.unitPrice * l.quantity)}
              </span>
            </div>
          </li>
        ))}
        {lines.length === 0 && (
          <li className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No dishes left. Add one, or cancel the order instead.
          </li>
        )}
      </ul>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {order.type === "delivery" && (
          <MoneyField label="Delivery fee" value={fee} onChange={setFee} />
        )}
        <MoneyField label="Discount" value={discount} onChange={setDiscount} />
      </div>

      <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{money(subtotal)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-semibold">New total</span>
          <span className="text-right tabular-nums">
            <span className="text-lg font-semibold">{money(total)}</span>
            {Math.abs(diff) > 0.004 && (
              <span
                className={cn(
                  "ml-2 text-xs font-semibold",
                  diff > 0
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-emerald-700 dark:text-emerald-400",
                )}
              >
                {diff > 0 ? "+" : "−"}
                {money(Math.abs(diff))}
              </span>
            )}
          </span>
        </div>
        {paidByCard && Math.abs(diff) > 0.004 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Paid by card:{" "}
            {diff > 0
              ? `collect ${money(diff)} at ${order.type === "delivery" ? "delivery" : "pickup"}.`
              : `you can refund ${money(-diff)} after saving.`}
          </p>
        )}
      </div>

      <label className="mt-4 block text-sm font-medium">
        Why did it change?{" "}
        <span className="font-normal text-muted-foreground">
          (kept in the history)
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={240}
          placeholder="e.g. Guest called to add a dessert"
          className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </label>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={save.isPending}
          className="h-10 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={
            save.isPending || lines.length === 0 || reason.trim().length < 2
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {save.isPending && <Loader2 className="size-4 animate-spin" />} Save
          changes
        </button>
      </div>

      {picking && (
        <DishPicker
          menu={menu}
          shared={shared}
          onClose={() => setPicking(false)}
          onAdd={(line) => {
            setLines((ls) => [...ls, line]);
            setPicking(false);
          }}
        />
      )}
    </section>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        inputMode="decimal"
        className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
    </label>
  );
}

/** Pick a dish from the menu with its size and options, like the website's dish sheet */
function DishPicker({
  menu,
  shared,
  onClose,
  onAdd,
}: {
  menu: PublicMenuCategory[];
  shared: Shared;
  onClose: () => void;
  onAdd: (line: DraftLine) => void;
}) {
  const money = (n: number) => formatMoney(n, shared.currency).main;
  const [search, setSearch] = useState("");
  const [dish, setDish] = useState<PublicDish | null>(null);
  const [variantId, setVariantId] = useState<string | undefined>();
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  const found = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu
      .map((c) => ({
        ...c,
        items: c.items.filter((d) => !q || d.name.toLowerCase().includes(q)),
      }))
      .filter((c) => c.items.length > 0);
  }, [menu, search]);

  const pick = (d: PublicDish) => {
    setDish(d);
    setVariantId(d.variants.find((v) => v.isDefault)?.id ?? d.variants[0]?.id);
    setOptionIds(
      d.modifierGroups.flatMap((g) =>
        g.options.filter((o) => o.isDefault).map((o) => o.id),
      ),
    );
    setQuantity(1);
    setNote("");
  };

  const variant = dish?.variants.find((v) => v.id === variantId);
  const base = dish
    ? variant
      ? (variant.salePrice ?? variant.price)
      : (dish.salePrice ?? dish.price)
    : 0;
  const extras = dish
    ? dish.modifierGroups
        .flatMap((g) => g.options)
        .filter((o) => optionIds.includes(o.id))
        .reduce((s, o) => s + (o.priceDelta ?? 0), 0)
    : 0;
  const unit = base + extras;
  const groupsOk = dish?.modifierGroups.every((g) => {
    const n = g.options.filter((o) => optionIds.includes(o.id)).length;
    return n >= g.minSelect && n <= g.maxSelect;
  });

  const toggle = (groupId: string, optionId: string) => {
    const group = dish!.modifierGroups.find((g) => g.id === groupId)!;
    const inGroup = group.options.map((o) => o.id);
    setOptionIds((ids) => {
      if (group.maxSelect === 1)
        return [...ids.filter((id) => !inGroup.includes(id)), optionId];
      if (ids.includes(optionId)) return ids.filter((id) => id !== optionId);
      if (ids.filter((id) => inGroup.includes(id)).length >= group.maxSelect)
        return ids;
      return [...ids, optionId];
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 text-left sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{dish ? dish.name : "Add a dish"}</DialogTitle>
          <DialogDescription>
            {dish
              ? "Choose the size and options."
              : "Today's prices, promotions included."}
          </DialogDescription>
        </DialogHeader>

        {!dish ? (
          <>
            <div className="border-b border-border p-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search the menu"
                  className="h-10 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {found.length === 0 && (
                <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {menu.length ? "No dish matches." : "The menu didn't load."}
                </p>
              )}
              {found.map((c) => (
                <div key={c.id} className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {c.name}
                  </p>
                  {c.items.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => pick(d)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted"
                    >
                      <Thumb src={d.image} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {d.name}
                        </span>
                        {!d.isAvailable && (
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            Sold out on the website
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {money(d.salePrice ?? d.price)}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <button
              type="button"
              onClick={() => setDish(null)}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" /> Pick another dish
            </button>
            {dish.variants.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Size</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {dish.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariantId(v.id)}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm",
                        variantId === v.id
                          ? "border-primary bg-primary/6 font-semibold"
                          : "border-border",
                      )}
                    >
                      {v.name}
                      <span className="tabular-nums">
                        {money(v.salePrice ?? v.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {dish.modifierGroups.map((g) => (
              <fieldset key={g.id}>
                <legend className="mb-2 text-sm font-semibold">
                  {g.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    {g.minSelect > 0 ? "required" : "optional"}
                    {g.maxSelect > 1 ? ` · up to ${g.maxSelect}` : ""}
                  </span>
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.options.map((o) => {
                    const on = optionIds.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggle(g.id, o.id)}
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm",
                          on
                            ? "border-primary bg-primary/6 font-semibold"
                            : "border-border",
                        )}
                      >
                        {o.name}
                        {(o.priceDelta ?? 0) > 0 && (
                          <span className="text-muted-foreground tabular-nums">
                            +{money(o.priceDelta!)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
              placeholder="Note for the kitchen (optional)"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
        )}

        {dish && (
          <DialogFooter className="m-0 flex-row items-center justify-between rounded-none border-t border-border px-5 py-3.5">
            <div className="flex items-center rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="One less"
                className="grid size-10 place-items-center"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-8 text-center font-semibold tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                aria-label="One more"
                className="grid size-10 place-items-center"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <button
              type="button"
              disabled={!groupsOk || (dish.variants.length > 0 && !variant)}
              onClick={() =>
                onAdd({
                  key: `new-${Date.now()}`,
                  itemId: dish.id,
                  variantId: variant?.id,
                  optionIds,
                  name: dish.name,
                  details: [
                    variant?.name,
                    ...dish.modifierGroups
                      .flatMap((g) => g.options)
                      .filter((o) => optionIds.includes(o.id))
                      .map((o) => o.name),
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  image: dish.image,
                  unitPrice: unit,
                  quantity,
                  note,
                })
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="size-4" /> Add · {money(unit * quantity)}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── kitchen ticket ───────────── */

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** An 80 mm ticket, printed straight away from a hidden frame */
function printTicket(order: AdminOrder, shared: Shared, brandName: string) {
  const money = (n: number) => formatMoney(n, shared.currency).main;
  const a = order.address;
  const lines = order.lines
    .map(
      (l) =>
        `<tr><td class="q">${l.quantity}×</td><td><b>${esc(l.name)}</b>${l.variantName ? ` (${esc(l.variantName)})` : ""}${
          l.options.length
            ? `<div class="s">${esc(l.options.map((o) => o.split(": ").pop()!).join(", "))}</div>`
            : ""
        }${l.note ? `<div class="n">» ${esc(l.note)}</div>` : ""}</td><td class="r">${money(l.total)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>#${esc(order.number)}</title><style>
    *{box-sizing:border-box}body{font:13px/1.35 ui-monospace,Menlo,Consolas,monospace;margin:0;padding:10px;width:80mm;color:#000}
    h1{font-size:26px;margin:0}h2{font-size:15px;margin:8px 0 4px}.c{text-align:center}.big{font-size:16px;font-weight:700}
    table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:3px 0}.q{width:28px;font-weight:700}.r{text-align:right;white-space:nowrap}
    .s{font-size:12px}.n{font-weight:700;margin-top:2px}hr{border:0;border-top:1px dashed #000;margin:8px 0}.box{border:2px solid #000;padding:6px;margin:6px 0;font-weight:700}
    @page{size:80mm auto;margin:0}
  </style></head><body>
    <div class="c">${esc(brandName)}</div>
    <div class="c"><h1>#${esc(order.number)}</h1><div class="big">${order.type === "delivery" ? "DELIVERY" : "PICKUP"}</div>
    <div>${order.schedule.asap ? `ASAP · by ${formatClock(order.schedule.to, shared)}` : `FOR ${formatClock(order.schedule.from, shared, true)}`}</div></div>
    <hr><table>${lines}</table>
    ${order.notes ? `<div class="box">NOTE: ${esc(order.notes)}</div>` : ""}
    ${order.cutlery ? "<div>+ Cutlery & napkins</div>" : ""}
    <hr>
    <div class="big" style="display:flex;justify-content:space-between"><span>TOTAL</span><span>${money(order.amounts.total)}</span></div>
    <div>${order.payment.method === "card" ? (order.payment.status === "paid" ? "PAID BY CARD" : "CARD") : `CASH TO COLLECT${order.payment.cashChangeFor ? ` · change for ${money(order.payment.cashChangeFor)}` : ""}`}</div>
    <hr><h2>${esc(order.customer.name)}</h2><div>${esc(order.customer.phone)}</div>
    ${a ? `<div>${esc([a.street, a.building && `Bldg ${a.building}`, a.floor && `Fl ${a.floor}`, a.apartment && `Apt ${a.apartment}`].filter(Boolean).join(", "))}</div>${a.area ? `<div>${esc(a.area)}</div>` : ""}${a.directions ? `<div><i>${esc(a.directions)}</i></div>` : ""}` : ""}
    <hr><div class="c">${formatClock(order.placedAt ?? order.createdAt, shared, true)}</div>
  </body></html>`;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  frame.srcdoc = html;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();

    setTimeout(() => frame.remove(), 60_000);
  };
  document.body.appendChild(frame);
}
