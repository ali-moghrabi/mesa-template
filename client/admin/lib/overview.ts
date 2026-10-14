import { formatPrice } from "@/admin/lib/menu/format";
import {
  formatTime,
  relativeDay,
  type ReservationStatus,
} from "@/lib/reservations";
import type { OrderStatus, OrderType } from "@/lib/checkout";

export const OVERVIEW_RANGES = [7, 30, 90] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];
export const overviewKey = (range: OverviewRange) =>
  ["admin-overview", range] as const;

export const parseRange = (value: unknown): OverviewRange => {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (OVERVIEW_RANGES as readonly number[]).includes(n)
    ? (n as OverviewRange)
    : 7;
};

export type Compare = { value: number; previous: number };

export type LiveOrders = {
  enabled: boolean;
  new: number;
  cooking: number;
  ready: number;
  oldestWaitingAt: string | null;
  today: { orders: Compare; cancelled: number; avgPrepMinutes: number | null };
  hourly: { hour: number; today: number; lastWeek: number }[];
  recent: {
    id: string;
    number: string;
    status: OrderStatus;
    type: OrderType;
    customer: string;
    itemCount: number;
    total: number;
    placedAt: string;
  }[];
};

export type ReservationsToday = {
  enabled: boolean;
  summary: {
    bookings: number;
    covers: number;
    pending: number;
    confirmed: number;
    seated: number;
    completed: number;
    noShow: number;
  };
  requests: number;
  next: {
    id: string;
    number: string;
    time: string;
    name: string;
    partySize: number;
    status: ReservationStatus;
    occasion?: string;
    table?: string;
  }[];
  week: { date: string; bookings: number; covers: number; pending: number }[];
};

export type MenuWatch = {
  soldOut: { id: string; name: string; image?: string }[];
  soldOutCount: number;
  dishes: number;
};

export type MessagesWatch = {
  enabled: boolean;
  unread: number;
  latest: {
    id: string;
    name: string;
    subject: string;
    preview: string;
    createdAt: string;
  }[];
};

export type ActivityItem =
  | {
      key: string;
      kind: "order";
      id: string;
      number: string;
      status: string;
      type: OrderType;
      name: string;
      by?: string;
      at: string;
    }
  | {
      key: string;
      kind: "reservation";
      id: string;
      number: string;
      status: string;
      name: string;
      partySize: number;
      date: string;
      time: string;
      by?: string;
      at: string;
    }
  | {
      key: string;
      kind: "message";
      id: string;
      name: string;
      subject: string;
      at: string;
    };

export type Sales = {
  range: OverviewRange;
  from: string;
  revenue: Compare;
  orders: Compare;
  average: Compare;
  covers: Compare;
  avgPrepMinutes: Compare;
  cancelled: Compare;
  todayRevenue: Compare;
  daily: {
    date: string;
    revenue: number;
    orders: number;
    previousRevenue: number;
    previousOrders: number;
  }[];
  topDishes: { name: string; quantity: number; revenue: number }[];
  channels: { type: OrderType; orders: number; revenue: number }[];
  payments: { method: "card" | "cash"; orders: number; revenue: number }[];
  heatmap: { day: number; hour: number; orders: number }[];
};

export type Overview = {
  serverTime: string;
  today: string;
  timezone: string;
  currency: string;
  restaurant: {
    open: boolean;
    label: string;
    closingSoon: boolean;
    special?: string;
    todayHours: string;
  };
  orders?: LiveOrders;
  reservations?: ReservationsToday;
  menu?: MenuWatch;
  messages?: MessagesWatch;
  activity: ActivityItem[];
  sales?: Sales;
};

export const formatMoney = (value: number, currency: string) =>
  formatPrice(value, currency);

export function compactMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
}

export const formatCount = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

export type Change = {
  label: string;
  tone: "good" | "bad" | "flat";
  direction: "up" | "down" | "flat";
};

export function change(
  { value, previous }: Compare,
  lowerIsBetter = false,
): Change | null {
  if (!value && !previous) return null;
  if (!previous)
    return {
      label: "New",
      tone: lowerIsBetter ? "flat" : "good",
      direction: "up",
    };
  const pct = Math.round(((value - previous) / previous) * 100);
  if (pct === 0) return { label: "0%", tone: "flat", direction: "flat" };
  const up = pct > 0;
  return {
    label: `${up ? "+" : "−"}${Math.abs(pct)}%`,
    tone: up !== lowerIsBetter ? "good" : "bad",
    direction: up ? "up" : "down",
  };
}

export function restaurantHour(iso: string, timeZone: string): number {
  try {
    return (
      Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone,
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date(iso)),
      ) % 24
    );
  } catch {
    return new Date(iso).getUTCHours();
  }
}

export function greeting(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export const hourLabel = (hour: number, format: "12h" | "24h") =>
  format === "24h"
    ? `${String(hour).padStart(2, "0")}:00`
    : `${hour % 12 || 12} ${hour < 12 || hour === 24 ? "AM" : "PM"}`;

export function ago(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`;
}

export function clockTime(
  iso: string,
  timeZone: string,
  format: "12h" | "24h",
): string {
  try {
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
    return formatTime(time, format);
  } catch {
    return iso.slice(11, 16);
  }
}

export type ActivityTone =
  | "rose"
  | "amber"
  | "sky"
  | "violet"
  | "emerald"
  | "zinc";
export type ActivityText = {
  title: string;
  detail: string;
  href: string;
  tone: ActivityTone;
  icon: "order" | "booking" | "message";
};

const ORDER_EVENTS: Record<string, [string, ActivityTone]> = {
  placed: ["New order #{n}", "rose"],
  accepted: ["Order #{n} accepted", "sky"],
  preparing: ["Order #{n} in the kitchen", "amber"],
  ready: ["Order #{n} ready for pickup", "violet"],
  out_for_delivery: ["Order #{n} out for delivery", "violet"],
  cancelled: ["Order #{n} cancelled", "zinc"],
  edited: ["Order #{n} changed", "sky"],
  refunded: ["Refund on order #{n}", "zinc"],
};

const BOOKING_EVENTS: Record<string, [string, ActivityTone]> = {
  pending: ["Booking request #{n}", "amber"],
  confirmed: ["Booking #{n} confirmed", "emerald"],
  seated: ["{name} arrived", "violet"],
  completed: ["{name}'s table finished", "sky"],
  no_show: ["No-show: {name}", "rose"],
  declined: ["Booking #{n} declined", "zinc"],
  cancelled: ["Booking #{n} cancelled", "zinc"],
};

const fill = (text: string, n: string, name: string) =>
  text.replace("{n}", n).replace("{name}", name || "Guest");
const by = (who?: string) => (who ? ` · by ${who}` : "");

export function activityText(
  item: ActivityItem,
  today: string,
  timeFormat: "12h" | "24h",
): ActivityText {
  if (item.kind === "message") {
    return {
      title: `Message from ${item.name}`,
      detail: item.subject,
      href: `/admin/messages?message=${item.id}`,
      tone: "sky",
      icon: "message",
    };
  }
  if (item.kind === "order") {
    const done = item.type === "delivery" ? "delivered" : "picked up";
    const [text, tone] =
      item.status === "completed"
        ? [`Order #{n} ${done}`, "emerald" as const]
        : (ORDER_EVENTS[item.status] ?? [
            "Order #{n} updated",
            "zinc" as const,
          ]);
    return {
      title: fill(text, item.number, item.name),
      detail: `${item.name || "Guest"} · ${item.type === "delivery" ? "Delivery" : "Pickup"}${by(item.by)}`,
      href: `/admin/orders?order=${item.id}`,
      tone,
      icon: "order",
    };
  }
  const [text, tone] = BOOKING_EVENTS[item.status] ?? [
    "Booking #{n} updated",
    "zinc" as const,
  ];
  const when = `${relativeDay(item.date, today)}, ${formatTime(item.time, timeFormat)}`;
  return {
    title: fill(text, item.number, item.name),
    detail: `${item.name} · ${item.partySize} ${item.partySize === 1 ? "guest" : "guests"} · ${when}${by(item.by)}`,
    href: `/admin/reservations?booking=${item.id}`,
    tone,
    icon: "booking",
  };
}
