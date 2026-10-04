import type { SiteConfig } from "@/config/schema";

type Business = {
  hours: NonNullable<SiteConfig["business"]["hours"]>; // optional in the config: callers check first
  specialHours: SiteConfig["business"]["specialHours"];
  timezone: SiteConfig["business"]["timezone"];
};
type Rule = { open?: string; close?: string; closed?: boolean };

export type OpenStatus = { open: boolean; label: string };

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (m: number) => {
  const x = m % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};

/** [open, close] in minutes. close > 1440 means it runs past midnight ("00:00" = 1440). */
const toSpan = (r?: Rule): [number, number] | null => {
  if (!r || r.closed || !r.open || !r.close) return null;
  const open = toMinutes(r.open);
  let close = toMinutes(r.close);
  if (close <= open) close += 1440;
  return [open, close];
};

export function getOpenStatus(b: Business, now: Date = new Date()): OpenStatus {
  // Wall-clock time in the restaurant's timezone, not the visitor's
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: b.timezone,
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  const dayIndex = DAYS.indexOf(
    p.weekday.toLowerCase() as (typeof DAYS)[number],
  );
  const minutes = (Number(p.hour) % 24) * 60 + Number(p.minute);
  const date = `${p.year}-${p.month}-${p.day}`;

  const prevDate = new Date(
    Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) - 1),
  )
    .toISOString()
    .slice(0, 10);

  const regular = (i: number) =>
    b.hours.find((h) => h.day === DAYS[(i + 7) % 7]);
  const special = (d: string) => b.specialHours.find((s) => s.date === d);
  const today = toSpan(special(date) ?? regular(dayIndex));
  const yesterday = toSpan(special(prevDate) ?? regular(dayIndex - 1));

  // Yesterday's late night (e.g. Friday until 02:00) still counts early Saturday
  if (yesterday && yesterday[1] > 1440 && minutes < yesterday[1] - 1440)
    return { open: true, label: `Open until ${fmt(yesterday[1])}` };
  if (today && minutes >= today[0] && minutes < today[1])
    return { open: true, label: `Open until ${fmt(today[1])}` };
  if (today && minutes < today[0])
    return { open: false, label: `Closed, opens today at ${fmt(today[0])}` };

  for (let k = 1; k <= 7; k++) {
    const next = toSpan(regular(dayIndex + k));
    if (next) {
      const day =
        k === 1
          ? "tomorrow"
          : DAYS[(dayIndex + k) % 7].replace(/^./, (c) => c.toUpperCase());
      return { open: false, label: `Closed, opens ${day} at ${fmt(next[0])}` };
    }
  }
  return { open: false, label: "Closed" };
}
