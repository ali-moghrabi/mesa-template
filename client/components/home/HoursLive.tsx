"use client";

import { useSyncExternalStore } from "react";
import { CalendarHeart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addDays,
  DAYS,
  dayName,
  getOpenStatus,
  restaurantClock,
  sortShifts,
  type OpeningHours,
  type Shift,
} from "@/lib/opening-hours";

export type TimeFormat = "12h" | "24h";

const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
};

const currentMinute = () => Math.floor(Date.now() / 60_000);
const noClock = () => null;

function useMinute(): number | null {
  return useSyncExternalStore(subscribe, currentMinute, noClock);
}

export function formatTime(time: string, format: TimeFormat): string {
  if (format === "24h") return time;
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 || 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 || h === 24 ? "AM" : "PM"}`;
}

export function shiftsText(shifts: Shift[], format: TimeFormat): string {
  if (shifts.length === 0) return "Closed";
  return sortShifts(shifts)
    .map(
      (s) => `${formatTime(s.open, format)} – ${formatTime(s.close, format)}`,
    )
    .join(", ");
}

type Tone = "default" | "inverted";

export function LiveStatus({
  hours,
  timeFormat,
  tone = "default",
  className,
}: {
  hours: OpeningHours;
  timeFormat: TimeFormat;
  tone?: Tone;
  className?: string;
}) {
  const minute = useMinute();
  const status =
    minute === null ? null : getOpenStatus(hours, new Date(minute * 60_000));
  const state =
    status === null
      ? "unknown"
      : status.open
        ? status.closingSoon
          ? "soon"
          : "open"
        : "closed";
  const label = status?.label.replace(/\b([01]\d|2[0-3]):[0-5]\d\b/g, (t) =>
    formatTime(t, timeFormat),
  );

  return (
    <p
      aria-live="polite"
      className={cn(
        "inline-flex min-h-9 items-center gap-2.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-opacity duration-300",
        state === "unknown" && "opacity-0",
        tone === "inverted"
          ? "bg-white/15 text-white backdrop-blur-md"
          : state === "open"
            ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
            : state === "soon"
              ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
              : "bg-foreground/[0.07] text-foreground/75",
        className,
      )}
    >
      <span className="relative flex size-2.5">
        {state === "open" && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2.5 rounded-full",
            state === "open"
              ? "bg-emerald-500"
              : state === "soon"
                ? "bg-amber-500"
                : "bg-foreground/35",
            tone === "inverted" && state === "closed" && "bg-white/60",
          )}
        />
      </span>
      {label ?? "Checking our hours"}
      {status?.special && (
        <span className="font-normal opacity-75">· {status.special}</span>
      )}
    </p>
  );
}

export function WeekTable({
  hours,
  timeFormat,
  className,
}: {
  hours: OpeningHours;
  timeFormat: TimeFormat;
  className?: string;
}) {
  const minute = useMinute();
  const clock =
    minute === null
      ? null
      : restaurantClock(hours.timezone, new Date(minute * 60_000));
  const todaySpecial = clock
    ? hours.exceptions.find((e) => e.date === clock.date)
    : undefined;

  const upcoming = clock
    ? hours.exceptions
        .filter(
          (e) => e.date > clock.date && e.date <= addDays(clock.date, 21).date,
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3)
    : [];

  return (
    <div className={className}>
      <dl className="space-y-0.5">
        {DAYS.map((day) => {
          const isToday = clock?.day === day;
          const shifts =
            isToday && todaySpecial
              ? todaySpecial.shifts
              : (hours.weekly.find((w) => w.day === day)?.shifts ?? []);
          const closed = shifts.length === 0;
          return (
            <div
              key={day}
              className={cn(
                "-mx-3 flex items-baseline justify-between gap-4 rounded-xl px-3 py-2 transition-colors",
                isToday && "bg-primary/8 font-semibold",
              )}
            >
              <dt className="flex items-center gap-2">
                {dayName(day)}
                {isToday && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary-foreground uppercase">
                    Today
                  </span>
                )}
                {isToday && todaySpecial && (
                  <span className="text-xs font-medium text-primary">
                    {todaySpecial.label}
                  </span>
                )}
              </dt>
              <dd
                className={cn(
                  "text-right tabular-nums",
                  closed ? "text-foreground/45" : "text-foreground/80",
                  isToday && "text-foreground",
                )}
              >
                {closed
                  ? "Closed"
                  : sortShifts(shifts).map((shift) => (
                      <span
                        key={shift.open}
                        className="block whitespace-nowrap"
                      >
                        {formatTime(shift.open, timeFormat)} –{" "}
                        {formatTime(shift.close, timeFormat)}
                      </span>
                    ))}
              </dd>
            </div>
          );
        })}
      </dl>

      {upcoming.length > 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-primary/30 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <CalendarHeart className="size-4" /> Special hours coming up
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {upcoming.map((s) => (
              <li key={s.date} className="flex justify-between gap-3">
                <span>
                  <span className="font-medium">{s.label}</span>{" "}
                  <span className="text-foreground/55">
                    {new Intl.DateTimeFormat("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    }).format(new Date(`${s.date}T12:00:00Z`))}
                  </span>
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    s.shifts.length === 0 && "text-foreground/55",
                  )}
                >
                  {shiftsText(s.shifts, timeFormat)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
