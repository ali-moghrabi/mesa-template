import { DAYS, type Day } from "@/lib/opening-hours";
import {
  daysLabel,
  MAX_PERCENT,
  promotionIssues,
  whenLabel,
  type PromotionRule,
  type PromotionScope,
  type PromotionState,
  type PromotionWindow,
} from "@/lib/promotions";

export const PROMOTIONS_PATH = "/admin/menu/promotions";

export type AdminPromotion = PromotionRule & {
  status: PromotionState;
  affectedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PromotionCatalog = {
  categories: {
    id: string;
    name: string;
    isActive: boolean;
    itemCount: number;
  }[];
  dishes: {
    id: string;
    name: string;
    categoryId: string;
    image?: string;
    imageBlur?: string;
    price: number;
    priceMinor: number;
    variants: { id: string; name: string; price: number; priceMinor: number }[];
    isVisible: boolean;
  }[];
};

export type PromotionFormValues = {
  name: string;
  percentOff: number;
  roundTo: number;
  scope: PromotionScope;
  categoryIds: string[];
  dishIds: string[];
  excludedDishIds: string[];
  startLater: boolean;
  startDate: string;
  startTime: string;
  endOnDate: boolean;
  endDate: string;
  endTime: string;
  onlyAtTimes: boolean;
  windows: PromotionWindow[];
  isActive: boolean;
};

export const WEEKDAYS: Day[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];
export const WEEKEND: Day[] = ["saturday", "sunday"];

export const PRESETS = {
  "happy-hour": {
    title: "Happy hour",
    text: "25% off, weekdays 17:00–19:00",
    values: {
      name: "Happy hour",
      percentOff: 25,
      onlyAtTimes: true,
      windows: [{ days: WEEKDAYS, from: "17:00", to: "19:00" }],
    },
  },
  "weekend-brunch": {
    title: "Weekend brunch",
    text: "15% off, Sat & Sun until 13:00",
    values: {
      name: "Weekend brunch",
      percentOff: 15,
      onlyAtTimes: true,
      windows: [{ days: WEEKEND, from: "09:00", to: "13:00" }],
    },
  },
  "menu-sale": {
    title: "Menu sale",
    text: "20% off everything, for a few days",
    values: { name: "Menu sale", percentOff: 20, endOnDate: true },
  },
} satisfies Record<
  string,
  { title: string; text: string; values: Partial<PromotionFormValues> }
>;
export type PresetKey = keyof typeof PRESETS;

export function emptyPromotion(
  today: string,
  preset?: PresetKey,
): PromotionFormValues {
  const inAWeek = new Date(`${today}T12:00:00Z`);
  inAWeek.setUTCDate(inAWeek.getUTCDate() + 7);
  return {
    name: "",
    percentOff: 20,
    roundTo: 0,
    scope: "menu",
    categoryIds: [],
    dishIds: [],
    excludedDishIds: [],
    startLater: false,
    startDate: today,
    startTime: "00:00",
    endOnDate: false,
    endDate: inAWeek.toISOString().slice(0, 10),
    endTime: "23:59",
    onlyAtTimes: false,
    windows: [],
    isActive: true,
    ...(preset ? PRESETS[preset].values : {}),
  };
}

export function toFormValues(
  p: AdminPromotion,
  today: string,
): PromotionFormValues {
  const blank = emptyPromotion(today);
  return {
    name: p.name,
    percentOff: p.percentOff,
    roundTo: p.roundTo,
    scope: p.scope,
    categoryIds: p.categoryIds,
    dishIds: p.dishIds,
    excludedDishIds: p.excludedDishIds,
    startLater: p.startsAt !== null,
    startDate: p.startsAt?.slice(0, 10) ?? blank.startDate,
    startTime: p.startsAt?.slice(11) ?? blank.startTime,
    endOnDate: p.endsAt !== null,
    endDate: p.endsAt?.slice(0, 10) ?? blank.endDate,
    endTime: p.endsAt?.slice(11) ?? blank.endTime,
    onlyAtTimes: p.windows.length > 0,
    windows: p.windows,
    isActive: p.isActive,
  };
}

export function toPromotionPayload(
  v: PromotionFormValues,
  timezone: string,
): Omit<PromotionRule, "id"> {
  return {
    name: v.name.trim(),
    percentOff: v.percentOff,
    roundTo: v.roundTo,
    scope: v.scope,
    categoryIds: v.scope === "categories" ? v.categoryIds : [],
    dishIds: v.scope === "dishes" ? v.dishIds : [],
    excludedDishIds: v.scope === "dishes" ? [] : v.excludedDishIds,
    startsAt: v.startLater ? `${v.startDate}T${v.startTime}` : null,
    endsAt: v.endOnDate ? `${v.endDate}T${v.endTime}` : null,
    windows: v.onlyAtTimes ? v.windows : [],
    timezone,
    isActive: v.isActive,
  };
}

export function promotionFormIssues(
  v: PromotionFormValues,
  timezone: string,
): Record<string, string> {
  const issues: Record<string, string> = {};
  for (const [path, message] of Object.entries(
    promotionIssues(toPromotionPayload(v, timezone)),
  ))
    issues[formPath(path)] ??= message;
  if (v.onlyAtTimes && v.windows.length === 0)
    issues.windows ??= "Add a time slot, or choose “All day”";
  if (!Number.isFinite(v.percentOff))
    issues.percentOff ??= `A whole number from 1 to ${MAX_PERCENT}`;
  return issues;
}

export const formPath = (path: string) =>
  path === "startsAt" ? "startDate" : path === "endsAt" ? "endDate" : path;

export const allDays = (): Day[] => [...DAYS];

export function statusInfo(
  status: PromotionState,
  timezone: string,
  now: Date,
): { label: string; tone: "live" | "soon" | "off" | "ended" } {
  switch (status.state) {
    case "running":
      return {
        label: status.endsAt
          ? `Running · until ${whenLabel(status.endsAt, timezone, now, "end")}`
          : "Running · no end date",
        tone: "live",
      };
    case "waiting":
      return {
        label: `Next: ${whenLabel(status.nextStart, timezone, now)}`,
        tone: "soon",
      };
    case "scheduled":
      return {
        label: `Starts ${whenLabel(status.nextStart, timezone, now)}`,
        tone: "soon",
      };
    case "paused":
      return { label: "Paused", tone: "off" };
    default:
      return { label: "Ended", tone: "ended" };
  }
}

export function scheduleLabel(rule: {
  startsAt: string | null;
  endsAt: string | null;
  windows: { days: Day[]; from: string; to: string }[];
}): string {
  const parts: string[] = [];
  parts.push(
    rule.windows.length
      ? rule.windows
          .map((w) => `${daysLabel(w.days)} ${w.from}–${w.to}`)
          .join(" · ")
      : "All day",
  );
  if (rule.startsAt) parts.push(`from ${shortStamp(rule.startsAt)}`);
  if (rule.endsAt) parts.push(`until ${shortStamp(rule.endsAt, "end")}`);
  return parts.join(" · ");
}

export const shortStamp = (stamp: string, kind: "start" | "end" = "start") => {
  let date = stamp.slice(0, 10);
  const time = stamp.slice(11);
  if (kind === "end" && time === "00:00") {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    date = d.toISOString().slice(0, 10);
  }
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return stamp;
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
  return time === "00:00" || (kind === "end" && time === "23:59")
    ? day
    : `${day} ${time}`;
};
