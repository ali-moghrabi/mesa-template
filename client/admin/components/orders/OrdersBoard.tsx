"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  BellOff,
  Bike,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Inbox,
  Loader2,
  MessageSquareText,
  Search,
  Store,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { formatMoney, type CurrencyConfig } from "@/lib/menu/money";
import type { PublicMenuCategory } from "@/lib/menu/public-menu";
import type { OrderStatus } from "@/lib/checkout";
import {
  changeOrderStatus,
  fetchBoard,
  fetchOrdersPage,
} from "@/admin/lib/orders.actions";
import {
  BOARD_COLUMNS,
  BOARD_KEY,
  ORDERS_PATH,
  STATUS_META,
  actionLabel,
  nextStatus,
  orderKey,
  statusText,
  type AdminOrderSummary,
  type Board,
  type HistoryFilters,
} from "@/admin/lib/orders";
import { disableAlerts, enableAlerts, useAlertsPref } from "./OrderAlerts";
import {
  OrderPanel,
  elapsed,
  formatClock,
  useNow,
  type TimeFormat,
} from "./OrderPanel";

const REFRESH_MS = 8_000;
const noopSubscribe = () => () => {};

const SHORT_TITLES: Record<string, string> = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
};

type Props = {
  initialBoard: Board;
  loadError: string | null;
  canEdit: boolean;
  currency: CurrencyConfig;
  timezone: string;
  timeFormat: TimeFormat;
  brandName: string;
  menu: PublicMenuCategory[];
  initialOrderId: string | null;
  initialTab: "board" | "history";
};

export type Shared = {
  currency: CurrencyConfig;
  timezone: string;
  timeFormat: TimeFormat;
};

export function OrdersBoard({
  initialBoard,
  loadError,
  canEdit,
  currency,
  timezone,
  timeFormat,
  brandName,
  menu,
  initialOrderId,
  initialTab,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"board" | "history">(initialTab);
  const [openId, setOpenId] = useState<string | null>(initialOrderId);
  const shared: Shared = { currency, timezone, timeFormat };

  const queryClient = useQueryClient();
  const board = useQuery({
    queryKey: BOARD_KEY,
    queryFn: async () => {
      const result = await fetchBoard();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    initialData: initialBoard,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: true,
  });

  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  useEffect(() => {
    const cached = queryClient.getQueryData<Board>(BOARD_KEY);
    if (!cached || cached.serverTime < initialBoard.serverTime)
      queryClient.setQueryData(BOARD_KEY, initialBoard);
  }, [initialBoard, queryClient]);

  const data = hydrated ? board.data : initialBoard;
  const inProgress = data.active.length;

  const open = (id: string | null) => {
    setOpenId(id);
    router.replace(id ? `${ORDERS_PATH}?order=${id}` : ORDERS_PATH, {
      scroll: false,
    });
  };

  return (
    <div className="mx-auto w-full max-w-375 px-4 pb-16 sm:px-8">
      {/* Header */}
      <header className="flex flex-col gap-4 pt-6 pb-5 sm:flex-row sm:items-end sm:justify-between lg:pt-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Service
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
            Orders
            <LiveDot failing={board.isError} fetching={board.isFetching} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-[15px]">
            {inProgress === 0
              ? "No orders in progress right now."
              : `${data.counts.placed} new · ${inProgress} in progress · ${data.done.length} finished today`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SoundToggle />
          <div
            role="tablist"
            aria-label="View"
            className="inline-flex rounded-xl border border-border bg-card p-1 shadow-xs"
          >
            {(["board", "history"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors",
                  tab === t
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "board" ? (
                  <ClipboardList className="size-4" />
                ) : (
                  <Inbox className="size-4" />
                )}
                {t === "board" ? "Live board" : "History"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {loadError && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </p>
      )}

      {tab === "board" ? (
        <BoardView board={data} shared={shared} onOpen={open} />
      ) : (
        <HistoryView shared={shared} onOpen={open} />
      )}

      <OrderPanel
        orderId={openId}
        onClose={() => open(null)}
        canEdit={canEdit}
        shared={shared}
        brandName={brandName}
        menu={menu}
      />
    </div>
  );
}

function LiveDot({
  failing,
  fetching,
}: {
  failing: boolean;
  fetching: boolean;
}) {
  return (
    <span
      title={
        failing
          ? "Can't reach the server. Retrying…"
          : "Live: updates every few seconds"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        failing
          ? "bg-destructive/10 text-destructive"
          : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
      )}
    >
      <span className="relative flex size-1.5">
        {!failing && (
          <span
            className={cn(
              "absolute inline-flex size-full rounded-full bg-emerald-500 opacity-70",
              fetching ? "animate-ping" : "",
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex size-1.5 rounded-full",
            failing ? "bg-destructive" : "bg-emerald-500",
          )}
        />
      </span>
      {failing ? "Offline" : "Live"}
    </span>
  );
}

function SoundToggle() {
  const pref = useAlertsPref();
  if (pref === null) return <span className="size-10" />;
  const on = pref === "on";
  return (
    <button
      type="button"
      onClick={() => (on ? disableAlerts() : void enableAlerts())}
      title={on ? "New-order sound is on" : "Turn on the new-order sound"}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium shadow-xs transition-colors",
        on
          ? "border-border bg-card hover:bg-muted"
          : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15",
      )}
    >
      {on ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      <span className="sr-only sm:not-sr-only">
        {on ? "Sound on" : "Sound off"}
      </span>
    </button>
  );
}

function BoardView({
  board,
  shared,
  onOpen,
}: {
  board: Board;
  shared: Shared;
  onOpen: (id: string) => void;
}) {
  const [mobileColumn, setMobileColumn] = useState(BOARD_COLUMNS[0].id);
  const columns = useMemo(
    () =>
      BOARD_COLUMNS.map((c) => ({
        ...c,
        orders: board.active.filter((o) => c.statuses.includes(o.status)),
      })),
    [board.active],
  );

  return (
    <>
      <div
        role="tablist"
        aria-label="Order stage"
        className="mb-4 grid grid-cols-4 gap-1.5 lg:hidden"
      >
        {columns.map((c) => {
          const active = mobileColumn === c.id;
          const count = c.orders.length;
          const urgent = c.id === "new" && count > 0;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${c.title}: ${count}`}
              onClick={() => setMobileColumn(c.id)}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 transition-colors",
                active
                  ? "border-foreground bg-foreground text-background shadow-sm"
                  : "border-border bg-card text-foreground",
                urgent && !active && "border-rose-500/50 bg-rose-500/6",
              )}
            >
              {/* The stage's colour, pulsing while new orders wait */}
              <span className="absolute top-1.5 right-1.5 flex size-2">
                {urgent && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-500 opacity-70" />
                )}
                <span
                  className={cn(
                    "relative inline-flex size-2 rounded-full",
                    STATUS_META[c.statuses[0]].dot,
                  )}
                />
              </span>
              <span
                className={cn(
                  "text-xl leading-none font-bold tabular-nums",
                  urgent && !active && "text-rose-600 dark:text-rose-400",
                  count === 0 && !active && "text-muted-foreground",
                )}
              >
                {count}
              </span>
              <span
                className={cn(
                  "w-full truncate text-center text-[11px] font-semibold",
                  active ? "text-background/80" : "text-muted-foreground",
                )}
              >
                {SHORT_TITLES[c.id] ?? c.title}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {columns.map((c) => (
          <section
            key={c.id}
            aria-label={c.title}
            className={cn(
              "flex min-h-50 flex-col rounded-2xl border border-border bg-muted/40 p-2.5 lg:min-h-[calc(100svh-14rem)]",
              mobileColumn !== c.id && "max-lg:hidden",
            )}
          >
            <header className="flex items-center justify-between px-1.5 pt-1 pb-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      STATUS_META[c.statuses[0]].dot,
                    )}
                  />
                  {c.title}
                </h2>
                <p className="text-xs text-muted-foreground">{c.hint}</p>
              </div>
              <span
                className={cn(
                  "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums",
                  c.id === "new" && c.orders.length
                    ? "bg-rose-500 text-white"
                    : "bg-card text-muted-foreground",
                )}
              >
                {c.orders.length}
              </span>
            </header>
            <ul className="flex flex-1 flex-col gap-2.5">
              {c.orders.map((order) => (
                <li key={order.id}>
                  <OrderCard order={order} shared={shared} onOpen={onOpen} />
                </li>
              ))}
              {c.orders.length === 0 && (
                <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  {c.id === "new"
                    ? "No new orders. They appear here with a chime."
                    : "Nothing here"}
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>

      {board.done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Finished in the last 12 hours
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {board.done.map((order) => (
              <li key={order.id}>
                <SummaryRow order={order} shared={shared} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function OrderCard({
  order,
  shared,
  onOpen,
}: {
  order: AdminOrderSummary;
  shared: Shared;
  onOpen: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const now = useNow();
  const next = nextStatus(order.type, order.status);
  const isNew = order.status === "placed";
  const waited = now === null ? 0 : now - Date.parse(order.placedAt);
  const urgency =
    isNew && order.schedule.asap
      ? waited > 10 * 60_000
        ? "late"
        : waited > 5 * 60_000
          ? "slow"
          : null
      : null;

  const move = useMutation({
    mutationFn: async (status: OrderStatus) => {
      const result = await changeOrderStatus(order.id, {
        status,
        version: order.version,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.message), {
          status: result.status,
        });
      return result.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(orderKey(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: BOARD_KEY });
    },
    onError: (error: Error & { status?: number }) => {
      toast.add({
        title: `Order #${order.number} didn't move`,
        description: error.message,
        type: "error",
      });
      void queryClient.invalidateQueries({ queryKey: BOARD_KEY });
    },
  });

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
        isNew ? "border-rose-500/40" : "border-border",
        urgency === "late" && "ring-2 ring-rose-500/60",
        move.isPending && "opacity-60",
      )}
    >
      {isNew && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1 bg-rose-500"
        />
      )}
      <button
        type="button"
        onClick={() => onOpen(order.id)}
        className="block w-full p-3.5 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[17px] font-semibold tracking-tight tabular-nums">
              #{order.number}
              {isNew && (
                <span className="rounded-full bg-rose-500 px-1.5 py-px text-[10px] font-bold tracking-wide text-white uppercase">
                  New
                </span>
              )}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {order.customer.name}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
              urgency === "late"
                ? "animate-pulse bg-rose-500 text-white"
                : urgency === "slow"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-muted text-muted-foreground",
            )}
            title={formatClock(order.placedAt, shared)}
          >
            {now === null ? "·" : elapsed(waited)}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs font-medium">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
            {order.type === "delivery" ? (
              <Bike className="size-3.5" />
            ) : (
              <Store className="size-3.5" />
            )}
            {order.type === "delivery" ? (order.area ?? "Delivery") : "Pickup"}
          </span>
          {!order.schedule.asap && (
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/12 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">
              <CalendarClock className="size-3.5" /> For{" "}
              {formatClock(order.schedule.from, shared, true)}
            </span>
          )}
          {order.hasNotes && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-amber-800 dark:text-amber-300">
              <MessageSquareText className="size-3.5" /> Note
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-2 text-sm">
          <span className="font-semibold tabular-nums">
            {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
          </span>{" "}
          <span className="text-muted-foreground">· {order.preview}</span>
        </p>

        <div className="mt-2.5 flex items-center justify-between text-sm">
          <span className="font-semibold tabular-nums">
            {formatMoney(order.total, shared.currency).main}
          </span>
          <PaymentBadge order={order} />
        </div>
      </button>

      {next && (
        <div className="border-t border-border p-2">
          <button
            type="button"
            disabled={move.isPending}
            onClick={() => move.mutate(next)}
            className={cn(
              "flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60",
              isNew
                ? "bg-rose-500 text-white hover:bg-rose-600"
                : "bg-foreground/6 hover:bg-foreground hover:text-background",
            )}
          >
            {move.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {actionLabel(order.type, next)}
            {!move.isPending && <ArrowRight className="size-3.5" />}
          </button>
        </div>
      )}
    </article>
  );
}

export function PaymentBadge({
  order,
}: {
  order: Pick<AdminOrderSummary, "payment">;
}) {
  const { method, status } = order.payment;
  const paid = status === "paid";
  const refunded = status === "refunded";
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-wide uppercase",
        refunded
          ? "bg-zinc-500/12 text-zinc-600 dark:text-zinc-300"
          : paid
            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-500/15 text-amber-800 dark:text-amber-300",
      )}
    >
      {refunded
        ? "Refunded"
        : method === "online"
          ? paid
            ? "Paid · online"
            : "Online pending"
          : paid
            ? "Paid · cash"
            : "Cash due"}
    </span>
  );
}

function SummaryRow({
  order,
  shared,
  onOpen,
}: {
  order: AdminOrderSummary;
  shared: Shared;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(order.id)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 sm:gap-4"
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          STATUS_META[order.status].dot,
        )}
      />
      <span className="w-16 shrink-0 font-semibold tabular-nums">
        #{order.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {order.customer.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {order.itemCount} {order.itemCount === 1 ? "item" : "items"} ·{" "}
          {order.preview}
        </span>
      </span>
      <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">
        {formatClock(order.placedAt, shared, true)}
      </span>
      <span
        className={cn(
          "hidden rounded-full px-2 py-0.5 text-xs font-semibold md:inline",
          STATUS_META[order.status].pill,
        )}
      >
        {statusText(order.type, order.status)}
      </span>
      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
        {formatMoney(order.total, shared.currency).main}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/* ───────────── history ───────────── */

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "In progress" },
  { value: "placed", label: "New" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function HistoryView({
  shared,
  onOpen,
}: {
  shared: Shared;
  onOpen: (id: string) => void;
}) {
  const [filters, setFilters] = useState<HistoryFilters>({ page: 1 });
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const query = {
    ...filters,
    q: q.length >= 2 || /^\d+$/.test(q) ? q : undefined,
  };

  const list = useQuery({
    queryKey: ["admin-orders", "history", query],
    queryFn: async () => {
      const result = await fetchOrdersPage(query);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    placeholderData: keepPreviousData,
  });

  const set = (patch: HistoryFilters) =>
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const field =
    "h-10 rounded-xl border border-border bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  const hasFilters = !!(
    filters.status ||
    filters.type ||
    filters.from ||
    filters.to ||
    search
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-60">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setFilters((f) => ({ ...f, page: 1 }));
            }}
            placeholder="Order number, name, phone or email"
            className={cn(field, "w-full pl-9")}
          />
        </label>
        <select
          value={filters.status ?? ""}
          onChange={(e) => set({ status: e.target.value || undefined })}
          className={field}
          aria-label="Status"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={filters.type ?? ""}
          onChange={(e) => set({ type: e.target.value || undefined })}
          className={field}
          aria-label="Type"
        >
          <option value="">Delivery & pickup</option>
          <option value="delivery">Delivery</option>
          <option value="pickup">Pickup</option>
        </select>
        <input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => set({ from: e.target.value || undefined })}
          className={field}
          aria-label="From"
        />
        <input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => set({ to: e.target.value || undefined })}
          className={field}
          aria-label="To"
        />
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilters({ page: 1 });
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" /> Clear
          </button>
        )}
      </div>

      <div
        className={cn(
          "mt-4 overflow-hidden rounded-2xl border border-border bg-card transition-opacity",
          list.isFetching && "opacity-70",
        )}
      >
        {list.isPending ? (
          <div className="space-y-px">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-16 animate-pulse bg-muted/50" />
            ))}
          </div>
        ) : list.isError ? (
          <p className="px-4 py-10 text-center text-sm text-destructive">
            {list.error.message}
          </p>
        ) : list.data.items.length === 0 ? (
          <p className="px-4 py-14 text-center text-sm text-muted-foreground">
            No orders match.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {list.data.items.map((order) => (
              <li key={order.id}>
                <SummaryRow order={order} shared={shared} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {list.data && list.data.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {list.data.total} orders · page {list.data.page} of{" "}
            {list.data.pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={list.data.page <= 1}
              onClick={() => set({ page: (filters.page ?? 1) - 1 })}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 font-medium disabled:opacity-40"
            >
              <ChevronLeft className="size-4" /> Newer
            </button>
            <button
              type="button"
              disabled={list.data.page >= list.data.pages}
              onClick={() => set({ page: (filters.page ?? 1) + 1 })}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 font-medium disabled:opacity-40"
            >
              Older <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
