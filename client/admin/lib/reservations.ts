import { z } from "zod";
import {
  DATE_PATTERN,
  NOTES_MAX,
  PHONE_PATTERN,
  TIME_PATTERN,
  type Reservation,
  type ReservationStatus,
} from "@/lib/reservations";

export const RESERVATIONS_PATH = "/admin/reservations";

export const RESERVATIONS_ROOT = ["admin-reservations"] as const;
export const dayKey = (date: string) =>
  ["admin-reservations", "day", date] as const;
export const REQUESTS_KEY = ["admin-reservations", "requests"] as const;
export const listKey = (filters: ListFilters) =>
  ["admin-reservations", "list", filters] as const;
export const reservationKey = (id: string) =>
  ["admin-reservations", "one", id] as const;

export type ReservationSource = "online" | "phone" | "walk_in";

export type AdminReservation = Reservation & {
  source: ReservationSource;
  hasAccount: boolean;
  table?: string;
  staffNote: string;
  updatedAt: string;
  version: string;
  history: { status: string; at: string; by?: string; note?: string }[];
  moves: ReservationStatus[];
};

export type GuestStats = {
  total: number;
  visits: number;
  noShows: number;
  cancelled: number;
  lastVisit: string | null;
};
export type AdminReservationDetail = AdminReservation & { guest: GuestStats };

export type DaySummary = {
  bookings: number;
  covers: number;
  pending: number;
  confirmed: number;
  seated: number;
  completed: number;
  noShow: number;
  cancelled: number;
};

export type DayView = {
  date: string;
  today: string;
  timezone: string;
  service: { closed: boolean; label: string; special?: string };
  summary: DaySummary;
  items: AdminReservation[];
  week: { date: string; bookings: number; covers: number; pending: number }[];
  slotMinutes: number;
  maxCoversPerSlot: number | null;
};

export type RequestsView = { items: AdminReservation[]; count: number };
export type ReservationsPage = {
  items: AdminReservation[];
  total: number;
  page: number;
  pages: number;
};
export type ListFilters = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
};

export const ADMIN_STATUS: Record<
  ReservationStatus,
  { label: string; pill: string; dot: string; bar: string }
> = {
  pending: {
    label: "Request",
    pill: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
  confirmed: {
    label: "Confirmed",
    pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  seated: {
    label: "Seated",
    pill: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
    bar: "bg-violet-500",
  },
  completed: {
    label: "Completed",
    pill: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
    bar: "bg-sky-500",
  },
  no_show: {
    label: "No-show",
    pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    bar: "bg-rose-500",
  },
  declined: {
    label: "Declined",
    pill: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-400",
    bar: "bg-zinc-400",
  },
  cancelled: {
    label: "Cancelled",
    pill: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-400",
    bar: "bg-zinc-400",
  },
};

export function moveLabel(
  from: ReservationStatus,
  to: ReservationStatus,
): string {
  switch (to) {
    case "confirmed":
      return from === "pending"
        ? "Confirm"
        : from === "seated"
          ? "Undo arrival"
          : from === "no_show"
            ? "They came"
            : "Restore";
    case "seated":
      return from === "completed" ? "Back to the table" : "Arrived";
    case "completed":
      return "Finish";
    case "no_show":
      return "No-show";
    case "declined":
      return "Decline";
    case "cancelled":
      return "Cancel booking";
    case "pending":
      return "Back to request";
  }
}

export const CLOSING: ReservationStatus[] = ["declined", "cancelled"];
export const PRIMARY_MOVE: Partial<
  Record<ReservationStatus, ReservationStatus>
> = {
  pending: "confirmed",
  confirmed: "seated",
  seated: "completed",
};

export const isUndo = (from: ReservationStatus, to: ReservationStatus) =>
  (from === "confirmed" && to === "pending") ||
  (from === "seated" && to === "confirmed") ||
  (from === "completed" && to === "seated");

export const SOURCE_LABEL: Record<ReservationSource, string> = {
  online: "Online",
  phone: "Phone",
  walk_in: "Walk-in",
};

export const DAY_FILTERS = [
  { id: "all", label: "All", statuses: null },
  { id: "pending", label: "Requests", statuses: ["pending"] },
  { id: "confirmed", label: "Confirmed", statuses: ["confirmed"] },
  { id: "seated", label: "Seated", statuses: ["seated"] },
  { id: "done", label: "Done", statuses: ["completed", "no_show"] },
  { id: "cancelled", label: "Cancelled", statuses: ["cancelled", "declined"] },
] as const satisfies readonly {
  id: string;
  label: string;
  statuses: readonly ReservationStatus[] | null;
}[];
export type DayFilter = (typeof DAY_FILTERS)[number]["id"];

const asDate = (date: string) => new Date(`${date}T12:00:00Z`);
export const shiftDate = (date: string, days: number) => {
  const d = asDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export const dayLabel = (
  date: string,
  today: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  },
) => {
  const diff = Math.round(
    (asDate(date).getTime() - asDate(today).getTime()) / 86_400_000,
  );
  const base = new Intl.DateTimeFormat("en-GB", {
    ...options,
    timeZone: "UTC",
  }).format(asDate(date));
  return diff === 0
    ? `Today · ${base}`
    : diff === 1
      ? `Tomorrow · ${base}`
      : diff === -1
        ? `Yesterday · ${base}`
        : base;
};
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

export const detailsSchema = z.object({
  date: z.string().regex(DATE_PATTERN, "Choose a date"),
  time: z.string().regex(TIME_PATTERN, "Choose a time"),
  partySize: z
    .number({ error: "Enter the number of guests" })
    .int()
    .min(1, "At least 1 guest")
    .max(100, "At most 100 guests"),
  name: z.string().trim().min(2, "Enter the guest's name").max(80),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || PHONE_PATTERN.test(v),
      "Enter a valid phone number",
    ),
  email: z
    .string()
    .trim()
    .max(120)
    .refine(
      (v) => v === "" || z.email().safeParse(v).success,
      "Enter a valid email",
    ),
  occasion: z.string().trim().max(40),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX, `Keep it under ${NOTES_MAX} characters`),
  table: z.string().trim().max(30, "Keep it short"),
  notify: z.boolean(),
});
export type DetailsValues = z.infer<typeof detailsSchema>;

export type CreatePayload = DetailsValues & {
  source: "phone" | "walk_in";
  seatNow: boolean;
};
export type UpdatePayload = DetailsValues & { version: string };

export const FIELD_FROM_API: Record<string, keyof DetailsValues> = {
  date: "date",
  time: "time",
  partySize: "partySize",
  name: "name",
  phone: "phone",
  email: "email",
  occasion: "occasion",
  notes: "notes",
  table: "table",
};
