"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso: string, days: number) =>
  fromUtc(toUtc(iso) + days * 86_400_000);
const monthOf = (iso: string) => iso.slice(0, 7);
const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const format = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(
    toUtc(iso),
  );

export function dayLabel(iso: string, today: string) {
  if (!iso) return "Pick a date";
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  return format(iso, { weekday: "short", day: "numeric", month: "short" });
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  trigger,
  triggerClassName,
  ariaLabel = "Choose a date",
}: {
  value: string;
  onChange: (iso: string) => void;
  min: string;
  max?: string;
  trigger: ReactNode;
  triggerClassName?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value || min));
  const [focus, setFocus] = useState(value || min);
  const grid = useRef<HTMLDivElement>(null);
  const start = useRef<HTMLButtonElement>(null);

  const allowed = (iso: string) => iso >= min && (!max || iso <= max);
  const firstMonth = monthOf(min);
  const lastMonth = max ? monthOf(max) : null;

  const first = `${month}-01`;
  const lead = (new Date(toUtc(first)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % 7) cells.push(null);

  const pick = (iso: string) => {
    if (!allowed(iso)) return;
    onChange(iso);
    setOpen(false);
  };

  const moveFocus = (iso: string) => {
    const next = iso < min ? min : max && iso > max ? max : iso;
    setFocus(next);
    if (monthOf(next) !== month) setMonth(monthOf(next));
    requestAnimationFrame(() =>
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)
        ?.focus(),
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in steps) {
      e.preventDefault();
      moveFocus(addDays(focus, steps[e.key]));
    } else if (e.key === "Home") {
      e.preventDefault();
      moveFocus(min);
    }
  };

  const quick = [
    { label: "Today", iso: min },
    { label: "Tomorrow", iso: addDays(min, 1) },
  ].filter((q) => allowed(q.iso));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const start = value || min;
          setMonth(monthOf(start));
          setFocus(start);
        }
      }}
    >
      <PopoverTrigger
        type="button"
        aria-label={ariaLabel}
        className={triggerClassName}
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        initialFocus={start}
        className="w-[min(20.5rem,calc(100vw-2rem))] rounded-2xl border-0 bg-neutral-900/95 p-3.5 text-white shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-2 pb-3">
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, -1))}
            disabled={month <= firstMonth}
            aria-label="Previous month"
            className={NAV}
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-[15px] font-semibold" aria-live="polite">
            {format(first, { month: "long", year: "numeric" })}
          </p>
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={!!lastMonth && month >= lastMonth}
            aria-label="Next month"
            className={NAV}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div
          ref={grid}
          role="grid"
          aria-label={format(first, { month: "long", year: "numeric" })}
          onKeyDown={onKeyDown}
          className="grid grid-cols-7 gap-1"
        >
          {WEEKDAYS.map((d) => (
            <span
              key={d}
              role="columnheader"
              className="pb-1 text-center text-xs font-medium text-white/45"
            >
              {d}
            </span>
          ))}
          {cells.map((iso, i) =>
            iso ? (
              <button
                key={iso}
                type="button"
                role="gridcell"
                data-day={iso}
                ref={iso === (value || min) ? start : undefined}
                tabIndex={iso === focus ? 0 : -1}
                disabled={!allowed(iso)}
                aria-selected={iso === value}
                aria-label={format(iso, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                onClick={() => pick(iso)}
                onFocus={() => setFocus(iso)}
                className={cn(
                  "relative grid aspect-square place-items-center rounded-xl text-sm font-medium tabular-nums transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-white/70",
                  iso === value
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "hover:bg-white/10",
                  iso === min &&
                    iso !== value &&
                    "ring-1 ring-white/25 ring-inset",
                  "disabled:cursor-not-allowed disabled:text-white/20 disabled:hover:bg-transparent",
                )}
              >
                {Number(iso.slice(8))}
              </button>
            ) : (
              <span key={`pad-${i}`} aria-hidden="true" />
            ),
          )}
        </div>

        {quick.length > 0 && (
          <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => pick(q.iso)}
                className={cn(
                  "h-8 flex-1 rounded-full text-sm font-medium transition-colors",
                  q.iso === value
                    ? "bg-white text-neutral-950"
                    : "bg-white/8 text-white hover:bg-white/15",
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const NAV =
  "grid size-8 cursor-pointer place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";
