"use client";

import Form from "next/form";
import { useSyncExternalStore } from "react";
import { CalendarDays, ChevronDown, Users } from "lucide-react";
import { RESERVATIONS_ROUTE } from "@/lib/reservations";
import { cn } from "@/lib/utils";

type BookingBarProps = {
  label: string;
  maxPartySize: number;
  minPartySize?: number;
  advanceDays?: number;
  timezone?: string;
  action?: string;
  className?: string;
};

const FIELD =
  "relative flex min-w-0 flex-col gap-0.5 rounded-[calc(var(--radius)*1.1)] bg-foreground/[0.05] px-3.5 py-2.5 transition-colors hover:bg-foreground/[0.08] focus-within:bg-foreground/[0.08] focus-within:ring-2 focus-within:ring-primary/50";
const LABEL = "flex items-center gap-1.5 text-xs text-foreground/65";
const CONTROL =
  "w-full min-w-0 appearance-none bg-transparent text-base font-medium outline-none";

const noSubscribe = () => () => {};
const noClock = () => "";

function dayIn(timeZone: string | undefined, days: number): string {
  const at = new Date(Date.now() + days * 86_400_000);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

export function BookingBar({
  label,
  maxPartySize,
  minPartySize = 1,
  advanceDays = 30,
  timezone,
  action = RESERVATIONS_ROUTE,
  className,
}: BookingBarProps) {
  const today = useSyncExternalStore(
    noSubscribe,
    () => dayIn(timezone, 0),
    noClock,
  );
  const lastDay = useSyncExternalStore(
    noSubscribe,
    () => dayIn(timezone, advanceDays),
    noClock,
  );

  const min = Math.max(1, Math.min(minPartySize, maxPartySize));
  const sizes = Array.from(
    { length: maxPartySize - min + 1 },
    (_, i) => min + i,
  );

  return (
    <Form
      action={action}
      aria-label="Quick reservation"
      className={cn(
        "grid w-full max-w-176 grid-cols-2 gap-2 rounded-[calc(var(--radius)*1.6)] bg-background p-2 text-foreground shadow-2xl shadow-black/30 sm:grid-cols-[1fr_1fr_auto]",
        className,
      )}
    >
      <label className={FIELD}>
        <span className={LABEL}>
          <CalendarDays aria-hidden="true" className="size-3.5" />
          Date
        </span>
        <input
          type="date"
          name="date"
          min={today || undefined}
          max={lastDay || undefined}
          className={cn(CONTROL, "text-left")}
        />
      </label>

      <label className={FIELD}>
        <span className={LABEL}>
          <Users aria-hidden="true" className="size-3.5" />
          Guests
        </span>
        <select
          name="party"
          defaultValue={Math.min(Math.max(2, min), maxPartySize)}
          className={cn(CONTROL, "pr-6")}
        >
          {sizes.map((n) => (
            <option key={n} value={n} className="bg-background text-foreground">
              {n} {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 bottom-3 size-4 text-foreground/60"
        />
      </label>

      <button
        type="submit"
        className="col-span-2 inline-flex min-h-13.5 cursor-pointer items-center justify-center rounded-[calc(var(--radius)*1.1)] bg-primary px-7 font-semibold text-white transition hover:bg-primary/80 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:col-span-1"
      >
        {label}
      </button>
    </Form>
  );
}
