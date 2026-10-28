"use client";

import Form from "next/form";
import { useState, useSyncExternalStore } from "react";
import { CalendarDays, ChevronDown, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RESERVATIONS_ROUTE } from "@/lib/reservations";
import { cn } from "@/lib/utils";
import { DatePicker, dayLabel } from "./DatePicker";

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
  "relative flex h-auto w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[calc(var(--radius)*1.2)] border-0 bg-transparent px-4 py-2.5 text-left text-white outline-none transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-white/45 data-popup-open:bg-white/10 dark:bg-transparent dark:hover:bg-white/8";
const LABEL = "flex items-center gap-1.5 text-xs font-normal text-white/65";
const VALUE = "block truncate text-base font-medium text-white";

const POPUP =
  "rounded-2xl border-0 bg-neutral-900/95 p-1.5 text-white shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10 backdrop-blur-xl";

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
  const guests = (n: number) => `${n} ${n === 1 ? "guest" : "guests"}`;
  const items = sizes.map((n) => ({ value: String(n), label: guests(n) }));

  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const [party, setParty] = useState(
    String(Math.min(Math.max(2, min), maxPartySize)),
  );

  return (
    <Form
      action={action}
      aria-label="Quick reservation"
      className={cn(
        "grid w-full max-w-176 grid-cols-2 gap-1.5 rounded-[calc(var(--radius)*1.7)] bg-white/9 p-1.5 text-white shadow-[0_30px_80px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/20 backdrop-blur-xl backdrop-saturate-150 sm:grid-cols-[1fr_1fr_auto]",
        className,
      )}
    >
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="party" value={party} />

      {today ? (
        <DatePicker
          value={date}
          onChange={setPicked}
          min={today}
          max={lastDay || undefined}
          ariaLabel={`Date: ${dayLabel(date, today)}. Change the date`}
          triggerClassName={FIELD}
          trigger={
            <>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={LABEL}>
                  <CalendarDays aria-hidden="true" className="size-3.5" />
                  Date
                </span>
                <span className={VALUE}>{dayLabel(date, today)}</span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-white/60"
              />
            </>
          }
        />
      ) : (
        <div className={FIELD} aria-hidden="true">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className={LABEL}>
              <CalendarDays className="size-3.5" />
              Date
            </span>
            <span className={cn(VALUE, "text-white/60")}>Today</span>
          </span>
        </div>
      )}

      <div className="relative before:absolute before:inset-y-3 before:left-[-3.5px] before:w-px before:bg-white/15">
        <Select
          items={items}
          value={party}
          onValueChange={(value) => value != null && setParty(String(value))}
        >
          <SelectTrigger
            aria-label="Guests"
            className={cn(
              FIELD,
              "data-[size=default]:h-auto [&>svg]:size-4 [&>svg]:text-white/60",
            )}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={LABEL}>
                <Users aria-hidden="true" className="size-3.5" />
                Guests
              </span>
              <SelectValue className={VALUE} />
            </span>
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            sideOffset={10}
            className={cn(POPUP, "max-h-72 min-w-44")}
          >
            {items.map((item) => (
              <SelectItem
                key={item.value}
                value={item.value}
                className="cursor-pointer rounded-xl py-2 pr-9 pl-3 text-[15px] text-white focus:bg-white/10 focus:text-white data-selected:font-semibold not-data-[variant=destructive]:focus:**:text-white [&_svg]:text-primary"
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        type="submit"
        className="col-span-2 inline-flex min-h-13.5 cursor-pointer items-center justify-center rounded-[calc(var(--radius)*1.2)] bg-primary px-8 font-semibold text-white shadow-lg shadow-primary/35 transition hover:brightness-110 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:col-span-1"
      >
        {label}
      </button>
    </Form>
  );
}
