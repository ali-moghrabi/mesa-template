"use client";

/**
 * The admin home page: what's happening right now, and (for managers and the owner) how the
 * restaurant is doing. Every block follows the person's permissions (the API leaves out what
 * they can't see) and the features the restaurant uses. Refreshes itself every minute.
 */

import Link from "next/link";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Bike,
  CalendarClock,
  CalendarDays,
  Check,
  ChefHat,
  Clock,
  CreditCard,
  Flame,
  Inbox,
  Mail,
  Minus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Store,
  Timer,
  TrendingDown,
  TrendingUp,
  Truck,
  Trophy,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDay, formatTime } from "@/lib/reservations";
import { ADMIN_STATUS } from "@/admin/lib/reservations";
import { STATUS_META, statusText } from "@/admin/lib/orders";
import { fetchOverview } from "@/admin/lib/overview.actions";
import {
  activityText,
  ago,
  change,
  clockTime,
  compactMoney,
  formatCount,
  formatMoney,
  greeting,
  OVERVIEW_RANGES,
  overviewKey,
  restaurantHour,
  type ActivityTone,
  type Compare,
  type Overview as OverviewData,
  type OverviewRange,
  type Sales,
} from "@/admin/lib/overview";
import { Heatmap, HourlyChart, TrendChart } from "./OverviewCharts";

type TimeFormat = "12h" | "24h";

type Props = {
  initial: OverviewData | null;
  loadError: string | null;
  initialRange: OverviewRange;
  firstName: string;
  timeFormat: TimeFormat;
};

const REFRESH_MS = 60_000;
const noSubscribe = () => () => {};

const unwrap = async <T,>(
  p: Promise<{ ok: true; data: T } | { ok: false; message: string }>,
): Promise<T> => {
  const result = await p;
  if (!result.ok) throw new Error(result.message);
  return result.data;
};

let nowValue = 0;
function subscribeNow(onChange: () => void) {
  const id = window.setInterval(() => {
    nowValue = Date.now();
    onChange();
  }, 30_000);
  return () => window.clearInterval(id);
}
const getNow = () => nowValue || (nowValue = Date.now());
const getServerNow = () => null;
const useNow = () => useSyncExternalStore(subscribeNow, getNow, getServerNow);

export function Overview({
  initial,
  loadError,
  initialRange,
  firstName,
  timeFormat,
}: Props) {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<OverviewRange>(initialRange);
  const now = useNow();

  const query = useQuery({
    queryKey: overviewKey(range),
    queryFn: () => unwrap(fetchOverview(range)),
    initialData: initial && range === initialRange ? initial : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });

  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  useEffect(() => {
    if (initial) queryClient.setQueryData(overviewKey(initialRange), initial);
  }, [initial, initialRange, queryClient]);
  const data = hydrated ? (query.data ?? initial) : initial;

  const pickRange = (next: OverviewRange) => {
    setRange(next);
    window.history.replaceState(
      null,
      "",
      next === 7 ? "/admin" : `/admin?range=${next}`,
    );
  };

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-350 px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xs">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-600">
            <AlertTriangle className="size-6" />
          </span>
          <h1 className="mt-4 text-lg font-semibold">
            The overview didn&apos;t load
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {(query.error as Error | null)?.message ??
              loadError ??
              "Something went wrong."}
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <RefreshCw
              className={cn("size-4", query.isFetching && "animate-spin")}
            />{" "}
            Try again
          </button>
        </div>
      </div>
    );
  }

  const orders =
    data.orders && (data.orders.enabled || data.orders.recent.length > 0)
      ? data.orders
      : undefined;
  const bookings =
    data.reservations &&
    (data.reservations.enabled || data.reservations.summary.bookings > 0)
      ? data.reservations
      : undefined;
  const messages =
    data.messages && (data.messages.enabled || data.messages.unread > 0)
      ? data.messages
      : undefined;
  const sales = orders ? data.sales : undefined;
  const nowHour = restaurantHour(data.serverTime, data.timezone);
  const shared: Shared = {
    data,
    now,
    timeFormat,
    money: (v) => formatMoney(v, data.currency),
  };

  return (
    <div className="mx-auto w-full max-w-350 px-4 pb-16 sm:px-8">
      <header className="flex flex-col gap-4 pt-6 pb-6 lg:flex-row lg:items-end lg:justify-between lg:pt-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            {formatDay(data.today, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
            {greeting(nowHour)}, {firstName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <OpenPill restaurant={data.restaurant} />
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> {data.restaurant.todayHours}
            </span>
            {data.restaurant.special && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                <Sparkles className="size-3" /> {data.restaurant.special}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sales && (
            <div
              role="tablist"
              aria-label="Sales period"
              className="inline-flex rounded-xl border border-border bg-card p-1 shadow-xs"
            >
              {OVERVIEW_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={range === r}
                  onClick={() => pickRange(r)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                    range === r
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r} days
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:text-foreground"
            aria-label="Refresh"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="tabular-nums">
              {now && query.dataUpdatedAt
                ? `Updated ${ago(new Date(query.dataUpdatedAt).toISOString(), now).toLowerCase()}`
                : "Live"}
            </span>
            <RefreshCw
              className={cn("size-3.5", query.isFetching && "animate-spin")}
            />
          </button>
        </div>
      </header>

      {query.isError && (
        <p
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-300"
        >
          <AlertTriangle className="size-4 shrink-0" /> Couldn&apos;t refresh:{" "}
          {(query.error as Error).message} Showing the last numbers.
        </p>
      )}

      <div
        className={cn(
          "space-y-4 transition-opacity",
          query.isPlaceholderData && "opacity-70",
        )}
      >
        <LiveStrip
          shared={shared}
          orders={orders}
          bookings={bookings}
          messages={messages}
        />

        <Row
          items={
            sales
              ? [
                  {
                    span: "lg:col-span-8",
                    node: (
                      <SalesCard
                        sales={sales}
                        shared={shared}
                        withCovers={!!bookings}
                      />
                    ),
                  },
                  {
                    span: "lg:col-span-4",
                    node: (
                      <TodayCard
                        orders={orders!}
                        sales={sales}
                        shared={shared}
                        nowHour={nowHour}
                      />
                    ),
                  },
                ]
              : [
                  orders && {
                    span: "lg:col-span-7",
                    node: (
                      <TodayCard
                        orders={orders}
                        shared={shared}
                        nowHour={nowHour}
                      />
                    ),
                  },
                  bookings && {
                    span: "lg:col-span-5",
                    node: <BookingsCard bookings={bookings} shared={shared} />,
                  },
                ]
          }
        />

        {sales && (
          <Row
            items={[
              {
                span: "lg:col-span-5",
                node: <TopDishesCard sales={sales} shared={shared} />,
              },
              {
                span: "lg:col-span-7",
                node: <BusiestCard sales={sales} timeFormat={timeFormat} />,
              },
            ]}
          />
        )}

        <Row
          items={[
            sales
              ? bookings && {
                  span: "lg:col-span-7",
                  node: <BookingsCard bookings={bookings} shared={shared} />,
                }
              : orders && {
                  span: "lg:col-span-7",
                  node: <LatestOrdersCard orders={orders} shared={shared} />,
                },
            { span: "lg:col-span-5", node: <ActivityCard shared={shared} /> },
          ]}
        />

        <Row
          items={[
            sales &&
              orders && {
                span: "lg:col-span-7",
                node: <LatestOrdersCard orders={orders} shared={shared} />,
              },
            (messages || data.menu) && {
              span: "lg:col-span-5",
              node: (
                <div className="grid h-full gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {messages && (
                    <MessagesCard messages={messages} shared={shared} />
                  )}
                  {data.menu && <SoldOutCard menu={data.menu} />}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

type Shared = {
  data: OverviewData;
  now: number | null;
  timeFormat: TimeFormat;
  money: (value: number) => string;
};

type RowItem = { span: string; node: ReactNode };

function Row({ items }: { items: (RowItem | false | null | undefined | 0)[] }) {
  const shown = items.filter(Boolean) as RowItem[];
  if (!shown.length) return null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
      {shown.map((item, i) => (
        <div
          key={i}
          className={cn(
            "min-w-0",
            shown.length === 1 ? "lg:col-span-12" : item.span,
          )}
        >
          {item.node}
        </div>
      ))}
    </div>
  );
}

function Card({
  title,
  subtitle,
  icon: Icon,
  href,
  linkLabel = "Open",
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  icon: typeof Users;
  href?: string;
  linkLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="leading-tight font-semibold">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {href && (
            <Link
              href={href}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {linkLabel} <ArrowUpRight className="size-3.5" />
            </Link>
          )}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Users;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-0.5 max-w-64 text-xs text-pretty text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

function Delta({
  compare,
  lowerIsBetter,
  className,
}: {
  compare: Compare;
  lowerIsBetter?: boolean;
  className?: string;
}) {
  const c = change(compare, lowerIsBetter);
  if (!c) return null;
  const Icon =
    c.direction === "up"
      ? TrendingUp
      : c.direction === "down"
        ? TrendingDown
        : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        c.tone === "good" &&
          "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        c.tone === "bad" && "bg-rose-500/12 text-rose-700 dark:text-rose-300",
        c.tone === "flat" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3" />
      {c.label}
    </span>
  );
}

function OpenPill({ restaurant }: { restaurant: OverviewData["restaurant"] }) {
  const tone = restaurant.open
    ? restaurant.closingSoon
      ? "amber"
      : "emerald"
    : "zinc";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "emerald" &&
          "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        tone === "amber" &&
          "bg-amber-500/15 text-amber-800 dark:text-amber-300",
        tone === "zinc" && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "emerald"
            ? "bg-emerald-500"
            : tone === "amber"
              ? "bg-amber-500"
              : "bg-zinc-400",
        )}
      />
      {restaurant.label}
    </span>
  );
}

type Tone = "rose" | "amber" | "sky" | "violet" | "emerald" | "zinc";

const TONES: Record<Tone, { bubble: string; card: string; dot: string }> = {
  rose: {
    bubble: "bg-rose-500 text-white",
    card: "border-rose-500/30 bg-rose-500/[0.05] hover:border-rose-500/50",
    dot: "bg-rose-500",
  },
  amber: {
    bubble: "bg-amber-500 text-white",
    card: "border-amber-500/30 bg-amber-500/[0.06] hover:border-amber-500/50",
    dot: "bg-amber-500",
  },
  sky: {
    bubble: "bg-sky-500 text-white",
    card: "border-sky-500/30 bg-sky-500/[0.05] hover:border-sky-500/50",
    dot: "bg-sky-500",
  },
  violet: {
    bubble: "bg-violet-500 text-white",
    card: "border-violet-500/25 bg-violet-500/[0.05] hover:border-violet-500/45",
    dot: "bg-violet-500",
  },
  emerald: {
    bubble: "bg-emerald-500 text-white",
    card: "border-emerald-500/25 bg-emerald-500/[0.05] hover:border-emerald-500/45",
    dot: "bg-emerald-500",
  },
  zinc: { bubble: "bg-zinc-500 text-white", card: "", dot: "bg-zinc-400" },
};

type Tile = {
  id: string;
  label: string;
  value: number;
  hint: string;
  href: string;
  icon: typeof Users;
  tone: Tone;
  attention: boolean;
};

function LiveStrip({
  shared,
  orders,
  bookings,
  messages,
}: {
  shared: Shared;
  orders?: OverviewData["orders"];
  bookings?: OverviewData["reservations"];
  messages?: OverviewData["messages"];
}) {
  const { data, now } = shared;
  const tiles: Tile[] = [];

  if (orders) {
    const waitingMinutes =
      orders.oldestWaitingAt && now
        ? Math.max(
            0,
            Math.floor((now - Date.parse(orders.oldestWaitingAt)) / 60_000),
          )
        : null;
    tiles.push(
      {
        id: "new",
        label: "New orders",
        value: orders.new,
        hint: orders.new
          ? waitingMinutes !== null
            ? `Oldest waiting ${waitingMinutes} min`
            : "Waiting to be accepted"
          : "None waiting",
        href: "/admin/orders",
        icon: ShoppingBag,
        tone: "rose",
        attention: orders.new > 0,
      },
      {
        id: "cooking",
        label: "In the kitchen",
        value: orders.cooking,
        hint: "Accepted or preparing",
        href: "/admin/orders",
        icon: ChefHat,
        tone: "amber",
        attention: false,
      },
      {
        id: "ready",
        label: "Ready & on the way",
        value: orders.ready,
        hint: "Pickup or out with a driver",
        href: "/admin/orders",
        icon: Bike,
        tone: "violet",
        attention: false,
      },
    );
  }
  if (bookings) {
    tiles.push(
      {
        id: "requests",
        label: "Booking requests",
        value: bookings.requests,
        hint: bookings.requests ? "Waiting for an answer" : "All answered",
        href: "/admin/reservations?tab=requests",
        icon: CalendarClock,
        tone: "amber",
        attention: bookings.requests > 0,
      },
      {
        id: "guests",
        label: "Guests today",
        value: bookings.summary.covers,
        hint: `${bookings.summary.bookings} ${bookings.summary.bookings === 1 ? "booking" : "bookings"} · ${bookings.summary.seated} seated now`,
        href: "/admin/reservations",
        icon: Users,
        tone: "emerald",
        attention: false,
      },
    );
  }
  if (messages) {
    tiles.push({
      id: "messages",
      label: "Unread messages",
      value: messages.unread,
      hint: messages.unread ? "From the contact page" : "Inbox is clear",
      href: "/admin/messages",
      icon: Mail,
      tone: "sky",
      attention: messages.unread > 0,
    });
  }
  if (data.menu) {
    tiles.push({
      id: "soldout",
      label: "Sold out",
      value: data.menu.soldOutCount,
      hint: data.menu.soldOutCount
        ? `of ${data.menu.dishes} dishes`
        : "Everything available",
      href: "/admin/menu?stock=sold-out",
      icon: UtensilsCrossed,
      tone: "zinc",
      attention: false,
    });
  }
  if (!tiles.length) return null;

  return (
    <section
      aria-label="Right now"
      className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]"
    >
      {tiles.map((t) => {
        const hot = t.attention;
        return (
          <Link
            key={t.id}
            href={t.href}
            className={cn(
              "group relative flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs transition-[border-color,transform] hover:-translate-y-0.5 hover:border-foreground/20",
              hot && TONES[t.tone].card,
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm leading-tight font-medium text-muted-foreground">
                {t.label}
              </p>
              <span
                className={cn(
                  "relative grid size-8 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition-colors",
                  hot && TONES[t.tone].bubble,
                )}
              >
                <t.icon className="size-4" />
                {hot && (
                  <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
                    <span
                      className={cn(
                        "absolute inline-flex size-full animate-ping rounded-full opacity-70 motion-reduce:hidden",
                        TONES[t.tone].dot,
                      )}
                    />
                    <span
                      className={cn(
                        "relative inline-flex size-2.5 rounded-full ring-2 ring-card",
                        TONES[t.tone].dot,
                      )}
                    />
                  </span>
                )}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
                {formatCount(t.value)}
              </p>
              <p className="mt-1.5 truncate text-xs text-muted-foreground">
                {t.hint}
              </p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

function SalesCard({
  sales,
  shared,
  withCovers,
}: {
  sales: Sales;
  shared: Shared;
  withCovers: boolean;
}) {
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const { money, data } = shared;
  const short = sales.range === 7;

  const kpis: {
    label: string;
    value: string;
    compare: Compare;
    previous: string;
    icon: typeof Users;
    lowerIsBetter?: boolean;
  }[] = [
    {
      label: "Revenue",
      value: money(sales.revenue.value),
      compare: sales.revenue,
      previous: money(sales.revenue.previous),
      icon: Banknote,
    },
    {
      label: "Orders",
      value: formatCount(sales.orders.value),
      compare: sales.orders,
      previous: formatCount(sales.orders.previous),
      icon: ShoppingBag,
    },
    {
      label: "Average order",
      value: money(sales.average.value),
      compare: sales.average,
      previous: money(sales.average.previous),
      icon: BarChart3,
    },
    withCovers
      ? {
          label: "Guests seated",
          value: formatCount(sales.covers.value),
          compare: sales.covers,
          previous: formatCount(sales.covers.previous),
          icon: Users,
        }
      : {
          label: "Kitchen time",
          value: sales.avgPrepMinutes.value
            ? `${sales.avgPrepMinutes.value} min`
            : "—",
          compare: sales.avgPrepMinutes,
          previous: sales.avgPrepMinutes.previous
            ? `${sales.avgPrepMinutes.previous} min`
            : "—",
          icon: Timer,
          lowerIsBetter: true,
        },
  ];

  const points = sales.daily.map((d) => ({
    date: d.date,
    value: metric === "revenue" ? d.revenue : d.orders,
    previous: metric === "revenue" ? d.previousRevenue : d.previousOrders,
  }));

  return (
    <Card
      title="Sales"
      subtitle={`Last ${sales.range} days, compared with the ${sales.range} days before`}
      icon={TrendingUp}
      href="/admin/orders?tab=history"
      linkLabel="Orders"
      actions={
        <div
          role="tablist"
          aria-label="Chart"
          className="inline-flex rounded-lg bg-muted p-0.5"
        >
          {(["revenue", "orders"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={metric === m}
              onClick={() => setMetric(m)}
              className={cn(
                "h-7 rounded-md px-2.5 text-xs font-semibold capitalize transition-colors",
                metric === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0 bg-card p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <k.icon className="size-3.5" /> {k.label}
            </p>
            <p className="mt-1.5 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
              {k.value}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <Delta compare={k.compare} lowerIsBetter={k.lowerIsBetter} />
              <span className="truncate">was {k.previous}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <TrendChart
          data={points}
          label={metric === "revenue" ? "Revenue" : "Orders"}
          previousLabel={`Previous ${sales.range} days`}
          format={
            metric === "revenue"
              ? money
              : (v) => `${formatCount(v)} ${v === 1 ? "order" : "orders"}`
          }
          axisFormat={
            metric === "revenue"
              ? (v) => compactMoney(v, data.currency)
              : (v) => formatCount(Math.round(v * 10) / 10)
          }
          tickLabel={(d) =>
            formatDay(
              d,
              short ? { weekday: "short" } : { day: "numeric", month: "short" },
            )
          }
          dateLabel={(d) =>
            formatDay(d, { weekday: "short", day: "numeric", month: "short" })
          }
        />
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-primary" /> Last{" "}
            {sales.range} days
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-[1.5px] border-dashed border-foreground/40" />{" "}
            The {sales.range} days before
          </span>
        </p>
      </div>

      {(sales.channels.length > 0 || sales.payments.length > 0) && (
        <div className="mt-5 grid gap-5 border-t border-border pt-5 md:grid-cols-2">
          <Split
            title="How guests order"
            rows={sales.channels.map((c) => ({
              key: c.type,
              label: c.type === "delivery" ? "Delivery" : "Pickup",
              icon: c.type === "delivery" ? Truck : Store,
              orders: c.orders,
              revenue: money(c.revenue),
            }))}
          />
          <Split
            title="How they pay"
            rows={sales.payments.map((p) => ({
              key: p.method,
              label: p.method === "card" ? "Card" : "Cash",
              icon: p.method === "card" ? CreditCard : Banknote,
              orders: p.orders,
              revenue: money(p.revenue),
            }))}
          />
        </div>
      )}
    </Card>
  );
}

function Split({
  title,
  rows,
}: {
  title: string;
  rows: {
    key: string;
    label: string;
    icon: typeof Users;
    orders: number;
    revenue: string;
  }[];
}) {
  const total = rows.reduce((sum, r) => sum + r.orders, 0);
  const shades = ["bg-primary", "bg-foreground/30", "bg-foreground/15"];
  if (!total) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <div className="mt-2.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {rows.map((r, i) => (
          <span
            key={r.key}
            className={cn(
              "h-full first:rounded-l-full last:rounded-r-full",
              shades[i] ?? shades[2],
            )}
            style={{ width: `${(r.orders / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-[3px]",
                shades[i] ?? shades[2],
              )}
            />
            <r.icon className="size-3.5 text-muted-foreground" />
            <span className="font-medium">{r.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {Math.round((r.orders / total) * 100)}%
            </span>
            <span className="ml-auto text-muted-foreground tabular-nums">
              {formatCount(r.orders)} · {r.revenue}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TodayCard({
  orders,
  sales,
  shared,
  nowHour,
}: {
  orders: NonNullable<OverviewData["orders"]>;
  sales?: Sales;
  shared: Shared;
  nowHour: number;
}) {
  const { data, money, timeFormat } = shared;
  const weekday = formatDay(data.today, { weekday: "long" });
  const lastWeekLabel = `Last ${formatDay(data.today, { weekday: "short" })}`;
  const prep = orders.today.avgPrepMinutes;

  return (
    <Card
      title="Today"
      subtitle={`Compared with last ${weekday} at this time`}
      icon={Flame}
      href="/admin/orders"
      linkLabel="Board"
    >
      <div className={cn("grid grid-cols-2 gap-3", !sales && "sm:grid-cols-3")}>
        <Figure
          label="Orders"
          value={formatCount(orders.today.orders.value)}
          delta={<Delta compare={orders.today.orders} />}
        />
        {sales && (
          <Figure
            label="Revenue"
            value={money(sales.todayRevenue.value)}
            delta={<Delta compare={sales.todayRevenue} />}
          />
        )}
        <Figure
          label="Kitchen time"
          value={prep !== null ? `${prep} min` : "—"}
          delta={
            <span className="text-[11px] text-muted-foreground">
              placed → ready
            </span>
          }
        />
        <Figure
          label="Cancelled"
          value={formatCount(orders.today.cancelled)}
          delta={
            <span className="text-[11px] text-muted-foreground">
              orders today
            </span>
          }
          className={cn(!sales && "col-span-2 sm:col-span-1")}
        />
      </div>
      <div className="mt-auto pt-6">
        <HourlyChart
          hourly={orders.hourly}
          nowHour={nowHour}
          lastWeekLabel={lastWeekLabel}
          timeFormat={timeFormat}
        />
      </div>
    </Card>
  );
}

function Figure({
  label,
  value,
  delta,
  className,
}: {
  label: string;
  value: string;
  delta: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl bg-muted/60 p-3", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <div className="mt-1 min-h-5">{delta}</div>
    </div>
  );
}

function TopDishesCard({ sales, shared }: { sales: Sales; shared: Shared }) {
  const max = Math.max(1, ...sales.topDishes.map((d) => d.quantity));
  return (
    <Card
      title="Top dishes"
      subtitle={`Most ordered, last ${sales.range} days`}
      icon={Trophy}
      href="/admin/menu"
      linkLabel="Menu"
    >
      {sales.topDishes.length === 0 ? (
        <Empty
          icon={Trophy}
          title="No orders yet"
          text="Your best sellers show up here once orders come in."
        />
      ) : (
        <ol className="space-y-3">
          {sales.topDishes.map((d, i) => (
            <li key={`${d.name}-${i}`} className="min-w-0">
              <div className="flex items-baseline gap-3 text-sm">
                <span
                  className={cn(
                    "w-5 shrink-0 text-right text-xs font-semibold tabular-nums",
                    i < 3 ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {d.name}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {formatCount(d.quantity)} sold
                </span>
                <span className="w-20 shrink-0 text-right font-medium tabular-nums">
                  {shared.money(d.revenue)}
                </span>
              </div>
              <div className="mt-1.5 ml-8 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    i < 3 ? "bg-primary" : "bg-primary/45",
                  )}
                  style={{ width: `${(d.quantity / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function BusiestCard({
  sales,
  timeFormat,
}: {
  sales: Sales;
  timeFormat: TimeFormat;
}) {
  return (
    <Card
      title="Busiest times"
      subtitle={`Orders by day and hour, last ${sales.range} days`}
      icon={Activity}
    >
      {sales.heatmap.length === 0 ? (
        <Empty
          icon={Activity}
          title="Not enough orders yet"
          text="Once orders come in, you'll see which days and hours keep the kitchen busiest."
        />
      ) : (
        <Heatmap cells={sales.heatmap} timeFormat={timeFormat} />
      )}
    </Card>
  );
}

function BookingsCard({
  bookings,
  shared,
}: {
  bookings: NonNullable<OverviewData["reservations"]>;
  shared: Shared;
}) {
  const { data, timeFormat } = shared;
  const s = bookings.summary;
  const maxCovers = Math.max(1, ...bookings.week.map((d) => d.covers));

  return (
    <Card
      title="Bookings today"
      subtitle={`${s.bookings} ${s.bookings === 1 ? "booking" : "bookings"} · ${s.covers} guests expected`}
      icon={CalendarDays}
      href="/admin/reservations"
      linkLabel="Reservations"
    >
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Confirmed", value: s.confirmed, dot: "bg-emerald-500" },
          { label: "Seated", value: s.seated, dot: "bg-violet-500" },
          { label: "Finished", value: s.completed, dot: "bg-sky-500" },
          { label: "No-shows", value: s.noShow, dot: "bg-rose-500" },
        ].map((x) => (
          <div key={x.label} className="rounded-xl bg-muted/60 px-1 py-2.5">
            <p className="text-lg leading-none font-semibold tabular-nums">
              {x.value}
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", x.dot)} />
              {x.label}
            </p>
          </div>
        ))}
      </div>

      {bookings.requests > 0 && (
        <Link
          href="/admin/reservations?tab=requests"
          className="mt-3 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5 text-sm transition-colors hover:border-amber-500/50"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-amber-500 text-white">
            <Inbox className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-semibold">
              {bookings.requests}{" "}
              {bookings.requests === 1 ? "request" : "requests"}
            </span>{" "}
            <span className="text-muted-foreground">waiting for an answer</span>
          </span>
          <ArrowUpRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      <p className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Next up
      </p>
      {bookings.next.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          No more bookings expected today.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {bookings.next.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/reservations?booking=${r.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <span className="w-16 shrink-0 rounded-lg bg-muted py-1 text-center text-sm font-semibold tabular-nums">
                  {formatTime(r.time, timeFormat)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {r.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.partySize} {r.partySize === 1 ? "guest" : "guests"}
                    {r.table && ` · Table ${r.table}`}
                    {r.occasion && ` · ${r.occasion}`}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    ADMIN_STATUS[r.status].pill,
                  )}
                >
                  {ADMIN_STATUS[r.status].label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        This week
      </p>
      <div className="grid grid-cols-7 gap-1.5">
        {bookings.week.map((d) => {
          const today = d.date === data.today;
          return (
            <Link
              key={d.date}
              href={`/admin/reservations?date=${d.date}`}
              title={`${formatDay(d.date)}: ${d.bookings} bookings, ${d.covers} guests${d.pending ? `, ${d.pending} waiting` : ""}`}
              className={cn(
                "group flex flex-col items-center rounded-xl px-1 pt-2 pb-1.5 transition-colors hover:bg-muted/70",
                today && "bg-primary/[0.07]",
              )}
            >
              <span className="text-[11px] font-semibold tabular-nums">
                {d.covers}
              </span>
              <span className="mt-1 flex h-12 w-full max-w-7 items-end">
                <span
                  className={cn(
                    "w-full rounded-t-lg",
                    d.covers
                      ? today
                        ? "bg-primary"
                        : "bg-primary/45 group-hover:bg-primary/65"
                      : "h-0.5 rounded-full bg-foreground/10",
                  )}
                  style={
                    d.covers
                      ? {
                          height: `${Math.max(8, (d.covers / maxCovers) * 100)}%`,
                        }
                      : undefined
                  }
                />
              </span>
              <span
                className={cn(
                  "mt-1.5 text-[11px]",
                  today
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {today ? "Today" : formatDay(d.date, { weekday: "short" })}
              </span>
              <span className="mt-0.5 flex h-1.5 items-center">
                {d.pending > 0 && (
                  <span
                    className="size-1.5 rounded-full bg-amber-500"
                    title={`${d.pending} waiting`}
                  />
                )}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>Guests per day</span>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-amber-500" /> Requests
          waiting
        </span>
      </p>
    </Card>
  );
}

const ACTIVITY_TONES: Record<ActivityTone, string> = {
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  sky: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  zinc: "bg-muted text-muted-foreground",
};
const ACTIVITY_ICONS = {
  order: ShoppingBag,
  booking: CalendarDays,
  message: Mail,
};

function ActivityCard({ shared }: { shared: Shared }) {
  const { data, now, timeFormat } = shared;
  return (
    <Card title="Latest activity" subtitle="The last 24 hours" icon={Activity}>
      {data.activity.length === 0 ? (
        <Empty
          icon={Sparkles}
          title="Quiet so far"
          text="New orders, bookings and messages, and what the team does with them, show up here."
        />
      ) : (
        <ol className="relative -my-1">
          {data.activity.map((item, i) => {
            const text = activityText(item, data.today, timeFormat);
            const Icon = ACTIVITY_ICONS[text.icon];
            return (
              <li key={item.key} className="relative">
                {i < data.activity.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-10 bottom-0 left-4.25 w-px bg-border"
                  />
                )}
                <Link
                  href={text.href}
                  className="flex gap-3 rounded-xl py-2 pr-2 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      "relative grid size-9 shrink-0 place-items-center rounded-xl",
                      ACTIVITY_TONES[text.tone],
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {text.title}
                      </span>
                      <time
                        dateTime={item.at}
                        className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
                      >
                        {now
                          ? ago(item.at, now)
                          : clockTime(item.at, data.timezone, timeFormat)}
                      </time>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {text.detail}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/* ───────────── latest orders ───────────── */

function LatestOrdersCard({
  orders,
  shared,
}: {
  orders: NonNullable<OverviewData["orders"]>;
  shared: Shared;
}) {
  const { data, now, money, timeFormat } = shared;
  return (
    <Card
      title="Latest orders"
      subtitle="Newest first"
      icon={ShoppingBag}
      href="/admin/orders?tab=history"
      linkLabel="All orders"
    >
      {orders.recent.length === 0 ? (
        <Empty
          icon={ShoppingBag}
          title="No orders yet"
          text="Online orders show up here the moment they're placed."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {orders.recent.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/orders?order=${o.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                  {o.type === "delivery" ? (
                    <Truck className="size-4" />
                  ) : (
                    <Store className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      #{o.number}
                    </span>
                    <span className="truncate text-sm">
                      {o.customer || "Guest"}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {o.itemCount} {o.itemCount === 1 ? "item" : "items"} ·{" "}
                    {now
                      ? ago(o.placedAt, now)
                      : clockTime(o.placedAt, data.timezone, timeFormat)}
                  </span>
                </span>
                <span className="hidden shrink-0 sm:block">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      STATUS_META[o.status].pill,
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        STATUS_META[o.status].dot,
                      )}
                    />
                    {statusText(o.type, o.status)}
                  </span>
                </span>
                <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {money(o.total)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ───────────── messages & sold out ───────────── */

function MessagesCard({
  messages,
  shared,
}: {
  messages: NonNullable<OverviewData["messages"]>;
  shared: Shared;
}) {
  const { data, now, timeFormat } = shared;
  return (
    <Card
      title="Messages"
      subtitle={messages.unread ? `${messages.unread} unread` : "All read"}
      icon={Mail}
      href="/admin/messages"
      linkLabel="Inbox"
    >
      {messages.latest.length === 0 ? (
        <Empty
          icon={Check}
          title="Inbox is clear"
          text="New messages from the contact page land here."
        />
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {messages.latest.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/messages?message=${m.id}`}
                className="flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-500/12 text-sm font-semibold text-sky-700 uppercase dark:text-sky-300">
                  {m.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {m.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {now
                        ? ago(m.createdAt, now)
                        : clockTime(m.createdAt, data.timezone, timeFormat)}
                    </span>
                  </span>
                  <span className="block truncate text-xs font-medium">
                    {m.subject}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.preview}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SoldOutCard({ menu }: { menu: NonNullable<OverviewData["menu"]> }) {
  return (
    <Card
      title="Sold out"
      subtitle={
        menu.soldOutCount
          ? `${menu.soldOutCount} of ${menu.dishes} dishes`
          : `All ${menu.dishes} dishes available`
      }
      icon={UtensilsCrossed}
      href="/admin/menu?stock=sold-out"
      linkLabel="Manage"
    >
      {menu.soldOut.length === 0 ? (
        <Empty
          icon={Check}
          title="Everything is available"
          text="Dishes marked sold out during service show up here."
        />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {menu.soldOut.map((d) => (
            <li
              key={d.id}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/50 py-1 pr-3 pl-1 text-sm"
            >
              {d.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.image}
                  alt=""
                  className="size-6 shrink-0 rounded-full object-cover grayscale"
                />
              ) : (
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-card text-muted-foreground">
                  <UtensilsCrossed className="size-3" />
                </span>
              )}
              <span className="truncate text-muted-foreground line-through decoration-foreground/30">
                {d.name}
              </span>
            </li>
          ))}
          {menu.soldOutCount > menu.soldOut.length && (
            <li className="inline-flex items-center rounded-full px-2 text-sm text-muted-foreground">
              +{menu.soldOutCount - menu.soldOut.length} more
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
