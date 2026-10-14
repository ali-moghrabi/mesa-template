import { z } from "zod";

export const RESERVATIONS_ROUTE = "/reservations";
export const MY_RESERVATIONS_ROUTE = "/account/reservations";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "declined"
  | "cancelled"
  | "completed"
  | "no_show";

export type ReservationRules = {
  minPartySize: number;
  maxPartySize: number;
  slotMinutes: number;
  advanceDays: number;
  minNoticeMinutes: number;
  maxCoversPerSlot: number | null;
  requirePhone: boolean;
  allowSpecialRequests: boolean;
  occasions: string[];
  confirmationMessage: string;
};

export type AvailabilityDay = {
  date: string;
  closed: boolean;
  times: { time: string; left: number | null }[];
};

export type Availability = {
  timezone: string;
  today: string;
  days: AvailabilityDay[];
  rules: ReservationRules;
};

export type Reservation = {
  id: string;
  number: string;
  status: ReservationStatus;
  date: string;
  time: string;
  startsAt: string;
  timezone: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  occasion?: string;
  notes?: string;
  statusNote?: string;
  createdAt: string;
  canCancel: boolean;
};

export type MyReservations = { upcoming: Reservation[]; past: Reservation[] };

export type BookingPrefill = { date?: string; time?: string; party?: number };

export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,22}$/;
export const NOTES_MAX = 500;

export const bookingSchema = (requirePhone: boolean) =>
  z.object({
    partySize: z.number().int().min(1, "Choose how many guests"),
    date: z.string().regex(DATE_PATTERN, "Choose a date"),
    time: z.string().regex(TIME_PATTERN, "Choose a time"),
    phone: requirePhone
      ? z
          .string()
          .trim()
          .regex(PHONE_PATTERN, "Enter a phone number we can call")
      : z
          .string()
          .trim()
          .refine(
            (v) => v === "" || PHONE_PATTERN.test(v),
            "Enter a phone number we can call",
          ),
    occasion: z.string().max(40),
    notes: z
      .string()
      .trim()
      .max(NOTES_MAX, `Keep it under ${NOTES_MAX} characters`),
  });

export type BookingValues = z.infer<ReturnType<typeof bookingSchema>>;
export type BookingInput = BookingValues & { idempotencyKey: string };

export function readPrefill(
  params: Record<string, string | string[] | undefined>,
): BookingPrefill {
  const one = (key: string) => {
    const v = params[key];
    return typeof v === "string" ? v.trim() : undefined;
  };
  const date = one("date");
  const time = one("time");
  const party = Number(
    one("party") ?? one("guests") ?? one("people") ?? one("size"),
  );
  return {
    ...(date && DATE_PATTERN.test(date) && { date }),
    ...(time && TIME_PATTERN.test(time) && { time }),
    ...(Number.isInteger(party) && party > 0 && party <= 100 && { party }),
  };
}

export const STATUS_META: Record<
  ReservationStatus,
  { label: string; pill: string; dot: string }
> = {
  pending: {
    label: "Waiting for confirmation",
    pill: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  confirmed: {
    label: "Confirmed",
    pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  seated: {
    label: "At your table",
    pill: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  declined: {
    label: "Not available",
    pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  cancelled: {
    label: "Cancelled",
    pill: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
  completed: {
    label: "Visited",
    pill: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  no_show: {
    label: "Missed",
    pill: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
};

const asDate = (date: string) => new Date(`${date}T12:00:00Z`);

export const formatDay = (
  date: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  },
) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(
    asDate(date),
  );

export const guestsLabel = (n: number) =>
  `${n} ${n === 1 ? "guest" : "guests"}`;

export function relativeDay(date: string, today: string): string {
  const diff = Math.round(
    (asDate(date).getTime() - asDate(today).getTime()) / 86_400_000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return formatDay(date);
}

export function formatTime(time: string, format: "12h" | "24h"): string {
  if (format === "24h") return time;
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function groupTimes<T extends { time: string }>(
  times: T[],
): { label: string; times: T[] }[] {
  const groups: { label: string; times: T[] }[] = [];
  for (const t of times) {
    const h = Number(t.time.slice(0, 2));
    const label =
      h < 5
        ? "After midnight"
        : h < 11
          ? "Morning"
          : h < 17
            ? "Lunch"
            : "Dinner";
    const last = groups.at(-1);
    if (last?.label === label) last.times.push(t);
    else groups.push({ label, times: [t] });
  }
  return groups;
}

export function calendarFile(
  r: Pick<Reservation, "number" | "startsAt" | "partySize">,
  brand: string,
  address: string,
): string {
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const start = new Date(r.startsAt);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  const esc = (s: string) =>
    s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mesa//Reservations//EN",
    "BEGIN:VEVENT",
    `UID:reservation-${r.number}@mesa`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`Table at ${brand} (${guestsLabel(r.partySize)})`)}`,
    `LOCATION:${esc(address)}`,
    `DESCRIPTION:${esc(`Booking #${r.number}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadCalendar(
  r: Pick<Reservation, "number" | "startsAt" | "partySize">,
  brand: string,
  address: string,
) {
  const url = URL.createObjectURL(
    new Blob([calendarFile(r, brand, address)], { type: "text/calendar" }),
  );
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `table-${r.number}.ics`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
