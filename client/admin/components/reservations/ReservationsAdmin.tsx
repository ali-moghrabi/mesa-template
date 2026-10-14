"use client";

/**
 * /admin/reservations
 *   Day       the chosen day: totals, how busy each time is, every booking by time, quick actions
 *   Requests  bookings waiting for an answer, all days, soonest first
 *   All       search by name, phone, email or number, filter by status and dates
 * A click opens the booking in a side sheet. Managers and the owner confirm, seat, edit and take
 * phone bookings / walk-ins; staff see everything but change nothing.
 * Refreshes every minute (and when the tab comes back into view).
 */

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
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Inbox,
  Loader2,
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  Table2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatDay,
  formatTime,
  guestsLabel,
  type ReservationStatus,
} from "@/lib/reservations";
import {
  ADMIN_STATUS,
  CLOSING,
  DAY_FILTERS,
  PRIMARY_MOVE,
  RESERVATIONS_PATH,
  dayKey,
  dayLabel,
  initials,
  listKey,
  moveLabel,
  REQUESTS_KEY,
  shiftDate,
  type AdminReservation,
  type DayFilter,
  type DayView,
  type ListFilters,
  type RequestsView,
} from "@/admin/lib/reservations";
import {
  fetchDay,
  fetchRequests,
  fetchReservationsPage,
} from "@/admin/lib/reservations.actions";
import {
  ReasonDialog,
  ReservationPanel,
  SourceIcon,
  useMoveReservation,
  type Shared,
} from "./ReservationPanel";

type Tab = "day" | "requests" | "all";

type Props = {
  initialDay: DayView | null;
  loadError: string | null;
  canManage: boolean;
  timeFormat: "12h" | "24h";
  occasions: string[];
  initialId: string | null;
  initialTab: Tab;
};

const REFRESH_MS = 60_000;
const noSubscribe = () => () => {};

const unwrap = async <T,>(
  p: Promise<{ ok: true; data: T } | { ok: false; message: string }>,
): Promise<T> => {
  const r = await p;
  if (!r.ok) throw new Error(r.message);
  return r.data;
};

export function ReservationsAdmin({
  initialDay,
  loadError,
  canManage,
  timeFormat,
  occasions,
  initialId,
  initialTab,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [date, setDate] = useState(initialDay?.date ?? "");
  const [open, setOpen] = useState<string | null>(initialId);
  const [closing, setClosing] = useState<{
    reservation: AdminReservation;
    status: ReservationStatus;
  } | null>(null);

  const day = useQuery({
    queryKey: dayKey(date || "today"),
    queryFn: () => unwrap(fetchDay(date)),
    initialData:
      initialDay && date === initialDay.date ? initialDay : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });
  const requests = useQuery({
    queryKey: REQUESTS_KEY,
    queryFn: () => unwrap(fetchRequests()),
    refetchInterval: REFRESH_MS,
  });

  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  useEffect(() => {
    if (initialDay)
      queryClient.setQueryData(dayKey(initialDay.date), initialDay);
  }, [initialDay, queryClient]);
  const data = hydrated ? (day.data ?? initialDay) : initialDay;

  const shared: Shared = {
    timeFormat,
    timezone: data?.timezone ?? "UTC",
    today: data?.today ?? date,
    occasions,
    canManage,
  };

  const show = (id: string | null) => {
    setOpen(id);
    router.replace(
      id && id !== "new"
        ? `${RESERVATIONS_PATH}?booking=${id}`
        : RESERVATIONS_PATH,
      { scroll: false },
    );
  };
  const askReason = (
    reservation: AdminReservation,
    status: ReservationStatus,
  ) => setClosing({ reservation, status });
  const pendingCount = requests.data?.count ?? data?.summary.pending ?? 0;

  return (
    <div className="mx-auto w-full max-w-350 px-4 pb-16 sm:px-8">
      {/* Header */}
      <header className="flex flex-col gap-4 pt-6 pb-5 lg:flex-row lg:items-end lg:justify-between lg:pt-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Service
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
            Reservations
            {!canManage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <Eye className="size-3" /> View only
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-[15px]">
            {pendingCount > 0
              ? `${pendingCount} ${pendingCount === 1 ? "request is" : "requests are"} waiting for an answer.`
              : "All requests answered."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="View"
            className="inline-flex rounded-xl border border-border bg-card p-1 shadow-xs"
          >
            {(
              [
                { id: "day", label: "Day", icon: CalendarDays },
                { id: "requests", label: "Requests", icon: Inbox },
                { id: "all", label: "All", icon: Search },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-4" />
                {t.label}
                {t.id === "requests" && pendingCount > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                      tab === t.id
                        ? "bg-background/20"
                        : "bg-amber-500 text-white",
                    )}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => show("new")}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_var(--primary)] transition hover:brightness-110"
            >
              <Plus className="size-4" /> New booking
            </button>
          )}
        </div>
      </header>

      {loadError && !data && (
        <p
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle className="size-4" /> {loadError}
        </p>
      )}

      {tab === "day" && data && (
        <DayTab
          data={data}
          loading={day.isFetching && day.isPlaceholderData}
          failing={day.isError}
          shared={shared}
          onDate={setDate}
          onOpen={show}
          onAskReason={askReason}
        />
      )}
      {tab === "requests" && (
        <RequestsTab
          query={requests}
          shared={shared}
          onOpen={show}
          onAskReason={askReason}
          onDay={(d) => {
            setDate(d);
            setTab("day");
          }}
        />
      )}
      {tab === "all" && <AllTab shared={shared} onOpen={show} />}

      <ReservationPanel
        open={open}
        onClose={() => show(null)}
        onOpened={show}
        onAskReason={askReason}
        shared={shared}
      />
      <ReasonDialog target={closing} onClose={() => setClosing(null)} />
    </div>
  );
}

function DayTab({
  data,
  loading,
  failing,
  shared,
  onDate,
  onOpen,
  onAskReason,
}: {
  data: DayView;
  loading: boolean;
  failing: boolean;
  shared: Shared;
  onDate: (d: string) => void;
  onOpen: (id: string) => void;
  onAskReason: (r: AdminReservation, s: ReservationStatus) => void;
}) {
  const [filter, setFilter] = useState<DayFilter>("all");
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim().toLowerCase());
  const s = data.summary;

  const counts = useMemo(
    () =>
      Object.fromEntries(
        DAY_FILTERS.map((f) => [
          f.id,
          f.statuses
            ? data.items.filter((r) =>
                (f.statuses as readonly string[]).includes(r.status),
              ).length
            : data.items.length,
        ]),
      ),
    [data.items],
  );
  const shown = data.items.filter((r) => {
    const f = DAY_FILTERS.find((x) => x.id === filter);
    if (f?.statuses && !(f.statuses as readonly string[]).includes(r.status))
      return false;
    if (
      filter === "all" &&
      (r.status === "cancelled" || r.status === "declined")
    )
      return false;
    if (!q) return true;
    return [r.name, r.phone, r.email, r.number, r.table ?? ""].some((v) =>
      v.toLowerCase().includes(q),
    );
  });
  const groups = groupByTime(shown);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-3 shadow-xs sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => onDate(shiftDate(data.date, -1))}
            className={ICON_BTN}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => onDate(shiftDate(data.date, 1))}
            className={ICON_BTN}
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="min-w-0 flex-1 px-1">
            <p className="flex items-center gap-2 truncate text-lg font-semibold tracking-tight">
              {dayLabel(data.date, data.today)}
              {loading && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {failing && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                  Offline
                </span>
              )}
            </p>
            <p
              className={cn(
                "flex items-center gap-1.5 text-sm",
                data.service.closed
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground",
              )}
            >
              <Clock className="size-3.5" />
              {data.service.closed ? "Closed" : data.service.label}
              {data.service.special && (
                <span className="font-medium text-primary">
                  · {data.service.special}
                </span>
              )}
            </p>
          </div>
          {data.date !== data.today && (
            <button
              type="button"
              onClick={() => onDate(data.today)}
              className="h-9 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              Today
            </button>
          )}
          <label
            className={cn(ICON_BTN, "relative cursor-pointer")}
            title="Pick a date"
          >
            <CalendarRange className="size-4" />
            <span className="sr-only">Pick a date</span>
            <input
              type="date"
              value={data.date}
              onChange={(e) => e.target.value && onDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full"
            />
          </label>
        </div>

        <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
          {data.week.map((w) => {
            const on = w.date === data.date;
            const today = w.date === data.today;
            return (
              <button
                key={w.date}
                type="button"
                onClick={() => onDate(w.date)}
                aria-pressed={on}
                className={cn(
                  "relative flex w-17 shrink-0 flex-col items-center rounded-xl border px-1 py-2 transition-colors",
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-transparent hover:bg-muted",
                  w.date < data.today && !on && "opacity-55",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase",
                    on
                      ? "text-background/70"
                      : today
                        ? "text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  {today ? "Today" : formatDay(w.date, { weekday: "short" })}
                </span>
                <span className="text-xl leading-tight font-semibold tabular-nums">
                  {Number(w.date.slice(8))}
                </span>
                <span
                  className={cn(
                    "mt-0.5 text-[11px] tabular-nums",
                    on ? "text-background/75" : "text-muted-foreground",
                  )}
                >
                  {w.covers > 0 ? `${w.covers} guests` : "–"}
                </span>
                {w.pending > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-card"
                    title={`${w.pending} waiting`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Bookings"
          value={s.bookings}
          hint={`${s.covers} ${s.covers === 1 ? "guest" : "guests"}`}
          icon={CalendarDays}
        />
        <Stat
          label="Requests"
          value={s.pending}
          hint={s.pending > 0 ? "Need an answer" : "None waiting"}
          icon={Inbox}
          tone={s.pending > 0 ? "amber" : undefined}
          onClick={s.pending > 0 ? () => setFilter("pending") : undefined}
        />
        <Stat
          label="Seated"
          value={s.seated}
          hint={`${s.confirmed} still to come`}
          icon={Users}
          tone={s.seated > 0 ? "violet" : undefined}
        />
        <Stat
          label="Finished"
          value={s.completed}
          hint={
            s.noShow > 0
              ? `${s.noShow} no-show${s.noShow === 1 ? "" : "s"}`
              : s.cancelled > 0
                ? `${s.cancelled} cancelled`
                : "No no-shows"
          }
          icon={Check}
        />
      </section>

      <BusyChart
        items={data.items}
        shared={shared}
        cap={data.maxCoversPerSlot}
      />

      <section className="rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
            {DAY_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
                  filter === f.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    filter === f.id
                      ? "text-background/70"
                      : "text-muted-foreground/80",
                  )}
                >
                  {f.id === "all"
                    ? counts.all - (counts.cancelled ?? 0)
                    : counts[f.id]}
                </span>
              </button>
            ))}
          </div>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Name, phone, table, #"
            className="sm:w-64"
          />
        </div>

        {groups.length === 0 ? (
          <Empty
            icon={CalendarDays}
            title={
              data.items.length === 0
                ? data.service.closed
                  ? "Closed this day"
                  : "No bookings yet"
                : "Nothing matches"
            }
            text={
              data.items.length === 0
                ? "Bookings for this day will show up here."
                : "Try another filter or search."
            }
          />
        ) : (
          <ol className="divide-y divide-border">
            {groups.map((g) => (
              <li
                key={g.time}
                className="grid gap-x-4 px-3 py-3 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:px-4"
              >
                <div className="mb-2 flex items-baseline gap-2 sm:mb-0 sm:block sm:pt-2.5">
                  <p className="text-lg font-semibold tabular-nums">
                    {formatTime(g.time, shared.timeFormat)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {g.items.length} · {guestsLabel(g.covers)}
                  </p>
                </div>
                <ul className="space-y-2">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      <Row
                        reservation={r}
                        shared={shared}
                        onOpen={onOpen}
                        onAskReason={onAskReason}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

const ICON_BTN =
  "grid size-9 shrink-0 place-items-center rounded-lg border border-border transition-colors hover:bg-muted";

function groupByTime(items: AdminReservation[]) {
  const map = new Map<string, AdminReservation[]>();
  for (const r of items) map.set(r.time, [...(map.get(r.time) ?? []), r]);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, list]) => ({
      time,
      items: list,
      covers: list.reduce((n, r) => n + r.partySize, 0),
    }));
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Users;
  tone?: "amber" | "violet";
  onClick?: () => void;
}) {
  const className = cn(
    "flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-xs transition-colors",
    tone === "amber" && "border-amber-500/30 bg-amber-500/[0.06]",
    tone === "violet" && "border-violet-500/25 bg-violet-500/[0.05]",
    onClick && "hover:border-amber-500/50",
  );
  const body = (
    <>
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
      </div>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground",
          tone === "amber" && "bg-amber-500 text-white",
          tone === "violet" && "bg-violet-500 text-white",
        )}
      >
        <Icon className="size-4" />
      </span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

function BusyChart({
  items,
  shared,
  cap,
}: {
  items: AdminReservation[];
  shared: Shared;
  cap: number | null;
}) {
  const live = items.filter(
    (r) => r.status !== "cancelled" && r.status !== "declined",
  );
  const slots = groupByTime(live);
  if (slots.length < 2) return null;
  const max = Math.max(cap ?? 0, ...slots.map((s) => s.covers));
  return (
    <section
      aria-label="Guests by time"
      className="rounded-2xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Guests by time</p>
        <p className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-emerald-500" /> Booked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-amber-500" /> Requests
          </span>
          {cap && <span>Limit {cap}</span>}
        </p>
      </div>
      <div className="flex h-28 items-end gap-1.5 overflow-x-auto pb-6 sm:gap-2.5 scrollbar-thin">
        {slots.map((s) => {
          const pending = s.items
            .filter((r) => r.status === "pending")
            .reduce((n, r) => n + r.partySize, 0);
          const booked = s.covers - pending;
          return (
            <div
              key={s.time}
              className="group relative flex h-full max-w-16 min-w-8 flex-1 flex-col justify-end"
              title={`${s.time}: ${s.covers} guests`}
            >
              <span className="mb-1 text-center text-[11px] font-semibold text-muted-foreground tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
                {s.covers}
              </span>
              <div className="flex w-full flex-col overflow-hidden rounded-md">
                {pending > 0 && (
                  <div
                    className="bg-amber-500"
                    style={{ height: `${(pending / max) * 72}px` }}
                  />
                )}
                {booked > 0 && (
                  <div
                    className="bg-emerald-500"
                    style={{ height: `${(booked / max) * 72}px` }}
                  />
                )}
              </div>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-muted-foreground tabular-nums">
                {formatTime(s.time, shared.timeFormat)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Row({
  reservation: r,
  shared,
  showDate,
  onOpen,
  onAskReason,
}: {
  reservation: AdminReservation;
  shared: Shared;
  showDate?: boolean;
  onOpen: (id: string) => void;
  onAskReason: (r: AdminReservation, s: ReservationStatus) => void;
}) {
  const move = useMoveReservation();
  const status = ADMIN_STATUS[r.status];
  const quick: ReservationStatus[] = !shared.canManage
    ? []
    : r.status === "pending"
      ? (["declined", "confirmed"] as ReservationStatus[]).filter((m) =>
          r.moves.includes(m),
        )
      : PRIMARY_MOVE[r.status] && r.moves.includes(PRIMARY_MOVE[r.status]!)
        ? [PRIMARY_MOVE[r.status]!]
        : [];
  const faded =
    r.status === "cancelled" ||
    r.status === "declined" ||
    r.status === "no_show";

  const act = (m: ReservationStatus) =>
    CLOSING.includes(m)
      ? onAskReason(r, m)
      : move.mutate({ reservation: r, status: m });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(r.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(r.id);
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-xl border border-border bg-background py-2.5 pr-2.5 pl-4 transition-all outline-none hover:border-foreground/20 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50",
        faded && "opacity-60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 w-1", status.bar)}
      />
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold text-foreground/70">
        {initials(r.name)}
      </span>

      <div className="min-w-0 flex-1 basis-40">
        <p className="flex items-center gap-1.5 font-semibold">
          <span
            className={cn(
              "truncate",
              faded && "line-through decoration-foreground/30",
            )}
          >
            {r.name}
          </span>
          {r.source !== "online" && (
            <SourceIcon
              source={r.source}
              className="size-3.5 shrink-0 text-muted-foreground"
            />
          )}
          {r.occasion && (
            <Sparkles
              aria-label={r.occasion}
              className="size-3.5 shrink-0 text-primary"
            />
          )}
          {(r.notes || r.staffNote) && (
            <NotebookPen
              aria-label="Has notes"
              className="size-3.5 shrink-0 text-amber-600"
            />
          )}
        </p>
        <p className="truncate text-sm text-muted-foreground tabular-nums">
          {showDate && (
            <span className="font-medium text-foreground">
              {dayLabel(r.date, shared.today, {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}{" "}
              · {formatTime(r.time, shared.timeFormat)} ·{" "}
            </span>
          )}
          {r.phone || r.email || `#${r.number}`}
          {r.occasion && (
            <span className="hidden sm:inline"> · {r.occasion}</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex h-7 items-center gap-1 rounded-lg bg-muted px-2 text-sm font-semibold tabular-nums"
          title={guestsLabel(r.partySize)}
        >
          <Users className="size-3.5 text-muted-foreground" /> {r.partySize}
        </span>
        {r.table && (
          <span
            className="inline-flex h-7 items-center gap-1 rounded-lg bg-muted px-2 text-sm font-semibold"
            title="Table"
          >
            <Table2 className="size-3.5 text-muted-foreground" /> {r.table}
          </span>
        )}
        <span
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold",
            status.pill,
          )}
        >
          <span className={cn("size-1.5 rounded-full", status.dot)} />
          {status.label}
        </span>
      </div>

      {quick.length > 0 && (
        <div
          className="flex w-full gap-1.5 sm:w-auto"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {quick.map((m) => {
            const danger = CLOSING.includes(m);
            return (
              <button
                key={m}
                type="button"
                disabled={move.isPending}
                onClick={() => act(m)}
                aria-label={`${moveLabel(r.status, m)}: ${r.name}`}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-60 sm:flex-none",
                  danger
                    ? "border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                    : "bg-foreground text-background hover:opacity-90",
                )}
              >
                {move.isPending && move.variables?.status === m ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : danger ? (
                  <X className="size-4" />
                ) : (
                  <Check className="size-4" />
                )}
                {moveLabel(r.status, m)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RequestsTab({
  query,
  shared,
  onOpen,
  onAskReason,
  onDay,
}: {
  query: UseQueryResult<RequestsView>;
  shared: Shared;
  onOpen: (id: string) => void;
  onAskReason: (r: AdminReservation, s: ReservationStatus) => void;
  onDay: (date: string) => void;
}) {
  if (!query.data) {
    return query.isError ? (
      <ErrorBox
        message={query.error.message}
        onRetry={() => void query.refetch()}
      />
    ) : (
      <LoadingBox />
    );
  }
  const items = query.data.items;
  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card shadow-xs">
        <Empty
          icon={Check}
          title="All caught up"
          text="New booking requests from the website land here."
        />
      </section>
    );
  }
  const byDate = new Map<string, AdminReservation[]>();
  for (const r of items) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);

  return (
    <div className="space-y-4">
      {[...byDate.entries()].map(([d, list]) => (
        <section
          key={d}
          className="rounded-2xl border border-border bg-card shadow-xs"
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="font-semibold">{dayLabel(d, shared.today)}</p>
            <button
              type="button"
              onClick={() => onDay(d)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Open the day <ChevronRight className="size-4" />
            </button>
          </header>
          <ul className="space-y-2 p-3 sm:p-4">
            {list.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {formatTime(r.time, shared.timeFormat)}
                </span>
                <div className="min-w-0 flex-1">
                  <Row
                    reservation={r}
                    shared={shared}
                    onOpen={onOpen}
                    onAskReason={onAskReason}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AllTab({
  shared,
  onOpen,
}: {
  shared: Shared;
  onOpen: (id: string) => void;
}) {
  const [filters, setFilters] = useState<ListFilters>({
    status: "upcoming",
    page: 1,
  });
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const effective = { ...filters, q: q || undefined };
  const list = useQuery({
    queryKey: listKey(effective),
    queryFn: () => unwrap(fetchReservationsPage(effective)),
    placeholderData: keepPreviousData,
  });
  const set = (patch: Partial<ListFilters>) =>
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const noop = () => {};

  return (
    <section className="rounded-2xl border border-border bg-card shadow-xs">
      <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:p-4">
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            set({});
          }}
          placeholder="Search name, phone, email or #number"
        />
        <select
          value={filters.status ?? ""}
          onChange={(e) => set({ status: e.target.value || undefined })}
          className={SELECT}
          aria-label="Status"
        >
          <option value="upcoming">Upcoming</option>
          <option value="">Every status</option>
          {(Object.keys(ADMIN_STATUS) as ReservationStatus[]).map((s) => (
            <option key={s} value={s}>
              {ADMIN_STATUS[s].label}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="From"
          value={filters.from ?? ""}
          onChange={(e) => set({ from: e.target.value || undefined })}
          className={SELECT}
        />
        <input
          type="date"
          aria-label="To"
          value={filters.to ?? ""}
          onChange={(e) => set({ to: e.target.value || undefined })}
          className={SELECT}
        />
      </div>

      {!list.data ? (
        list.isError ? (
          <ErrorBox
            message={list.error.message}
            onRetry={() => void list.refetch()}
          />
        ) : (
          <LoadingBox />
        )
      ) : list.data.items.length === 0 ? (
        <Empty
          icon={Search}
          title="No bookings found"
          text="Try other words, another status or a wider date range."
        />
      ) : (
        <>
          <ul
            className={cn(
              "space-y-2 p-3 transition-opacity sm:p-4",
              list.isPlaceholderData && "opacity-60",
            )}
          >
            {list.data.items.map((r) => (
              <li key={r.id}>
                <Row
                  reservation={r}
                  shared={{ ...shared, canManage: false }}
                  showDate
                  onOpen={onOpen}
                  onAskReason={noop}
                />
              </li>
            ))}
          </ul>
          <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span className="tabular-nums">
              {list.data.total} {list.data.total === 1 ? "booking" : "bookings"}{" "}
              · page {list.data.page} of {list.data.pages}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={list.data.page <= 1}
                onClick={() => set({ page: list.data.page - 1 })}
                className={cn(ICON_BTN, "disabled:opacity-40")}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={list.data.page >= list.data.pages}
                onClick={() => set({ page: list.data.page + 1 })}
                className={cn(ICON_BTN, "disabled:opacity-40")}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

const SELECT =
  "h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function SearchBox({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">Search</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-input bg-transparent pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </label>
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
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-pretty text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

function LoadingBox() {
  return (
    <div className="grid place-items-center rounded-2xl border border-border bg-card py-16">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="mt-3 font-medium">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 h-9 rounded-lg border border-border bg-card px-4 text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}
