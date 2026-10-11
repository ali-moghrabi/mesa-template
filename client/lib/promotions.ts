import {
  addDays,
  DAYS,
  dayShort,
  restaurantClock,
  TIME_PATTERN,
  toMinutes,
  type Day,
} from "./opening-hours";

export type PromotionScope = "menu" | "categories" | "dishes";

export type PromotionWindow = { days: Day[]; from: string; to: string };

export type PromotionRule = {
  id: string;
  name: string;
  percentOff: number;
  roundTo: number;
  scope: PromotionScope;
  categoryIds: string[];
  dishIds: string[];
  excludedDishIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  windows: PromotionWindow[];
  timezone: string;
  isActive: boolean;
};

export const MAX_PERCENT = 90;
export const MAX_WINDOWS = 5;
export const ROUND_STEPS = [0, 5, 10, 25, 50, 100] as const;
export const STAMP_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/;

export function appliesTo(
  rule: Pick<
    PromotionRule,
    "scope" | "categoryIds" | "dishIds" | "excludedDishIds"
  >,
  dish: { id: string; categoryId: string },
) {
  if (rule.excludedDishIds.includes(dish.id)) return false;
  if (rule.scope === "menu") return true;
  if (rule.scope === "categories")
    return rule.categoryIds.includes(dish.categoryId);
  return rule.dishIds.includes(dish.id);
}

export type PromotionState =
  | { state: "running"; endsAt: string | null }
  | { state: "waiting"; nextStart: string }
  | { state: "scheduled"; nextStart: string }
  | { state: "paused" }
  | { state: "ended" };

type Clock = { stamp: string; date: string; day: Day; minutes: number };

export function localClock(timezone: string, now: Date = new Date()): Clock {
  const c = restaurantClock(timezone, now);
  const hh = String(Math.floor(c.minutes / 60)).padStart(2, "0");
  const mm = String(c.minutes % 60).padStart(2, "0");
  return { ...c, stamp: `${c.date}T${hh}:${mm}` };
}

export const stampDiff = (a: string, b: string) =>
  (Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 60_000;

const at = (date: string, time: string) => `${date}T${time}`;

const clockAt = (stamp: string): Clock => ({
  stamp,
  date: stamp.slice(0, 10),
  day: addDays(stamp.slice(0, 10), 0).day,
  minutes: toMinutes(stamp.slice(11)),
});
const minStamp = (a: string | null, b: string | null) =>
  a === null ? b : b === null ? a : a < b ? a : b;

function openWindowEnd(
  windows: PromotionWindow[],
  clock: Clock,
): string | null {
  let end: string | null = null;
  const yesterday = addDays(clock.date, -1);
  for (const w of windows) {
    const from = toMinutes(w.from);
    const to = toMinutes(w.to);
    const overnight = to <= from;

    if (
      w.days.includes(clock.day) &&
      clock.minutes >= from &&
      (overnight || clock.minutes < to)
    ) {
      end = maxStamp(
        end,
        overnight
          ? at(addDays(clock.date, 1).date, w.to)
          : at(clock.date, w.to),
      );
    }
    if (overnight && w.days.includes(yesterday.day) && clock.minutes < to)
      end = maxStamp(end, at(clock.date, w.to));
  }
  return end;
}
const maxStamp = (a: string | null, b: string) => (a === null || b > a ? b : a);

function nextWindowStart(
  windows: PromotionWindow[],
  from: string,
): string | null {
  const date = from.slice(0, 10);
  let best: string | null = null;
  for (let k = 0; k <= 15 && best === null; k++) {
    const d = addDays(date, k);
    for (const w of windows) {
      if (!w.days.includes(d.day)) continue;
      const start = at(d.date, w.from);
      if (start >= from && (best === null || start < best)) best = start;
    }
  }
  return best;
}

export function promotionState(
  rule: PromotionRule,
  now: Date = new Date(),
): PromotionState {
  const clock = localClock(rule.timezone, now);
  if (rule.endsAt && clock.stamp >= rule.endsAt) return { state: "ended" };
  if (!rule.isActive) return { state: "paused" };

  const earliest =
    rule.startsAt && rule.startsAt > clock.stamp ? rule.startsAt : null;
  if (rule.windows.length === 0) {
    return earliest
      ? { state: "scheduled", nextStart: earliest }
      : { state: "running", endsAt: rule.endsAt };
  }

  if (!earliest) {
    const windowEnd = openWindowEnd(rule.windows, clock);
    if (windowEnd)
      return { state: "running", endsAt: minStamp(windowEnd, rule.endsAt) };
  }

  const next =
    earliest && openWindowEnd(rule.windows, clockAt(earliest))
      ? earliest
      : nextWindowStart(rule.windows, earliest ?? clock.stamp);
  if (!next || (rule.endsAt && next >= rule.endsAt)) return { state: "ended" };
  return earliest
    ? { state: "scheduled", nextStart: next }
    : { state: "waiting", nextStart: next };
}

export function salePrice(
  priceMinor: number,
  rule: Pick<PromotionRule, "percentOff" | "roundTo">,
): number {
  const exact = (priceMinor * (100 - rule.percentOff)) / 100;
  const step = rule.roundTo > 0 ? rule.roundTo : 1;
  return Math.max(0, Math.floor(exact / step + 1e-9) * step);
}

export type Sale = { rule: PromotionRule; endsAt: string | null };

export function bestSale(
  rules: PromotionRule[],
  dish: { id: string; categoryId: string },
  now: Date = new Date(),
): Sale | null {
  let best: Sale | null = null;
  for (const rule of rules) {
    if (!appliesTo(rule, dish)) continue;
    const s = promotionState(rule, now);
    if (s.state !== "running") continue;
    if (
      !best ||
      rule.percentOff > best.rule.percentOff ||
      (rule.percentOff === best.rule.percentOff &&
        (s.endsAt ?? "9") < (best.endsAt ?? "9"))
    )
      best = { rule, endsAt: s.endsAt };
  }
  return best;
}

export function minutesUntilNextChange(
  rules: PromotionRule[],
  now: Date = new Date(),
): number | null {
  let soonest: number | null = null;
  for (const rule of rules) {
    const s = promotionState(rule, now);
    const when =
      s.state === "running"
        ? s.endsAt
        : s.state === "waiting" || s.state === "scheduled"
          ? s.nextStart
          : null;
    if (!when) continue;
    const minutes = stampDiff(localClock(rule.timezone, now).stamp, when);
    if (minutes >= 0 && (soonest === null || minutes < soonest))
      soonest = minutes;
  }
  return soonest;
}

export function promotionIssues(
  rule: Omit<PromotionRule, "id" | "isActive">,
): Record<string, string> {
  const issues: Record<string, string> = {};
  const add = (path: string, message: string) => {
    issues[path] ??= message;
  };
  const name = rule.name.trim();
  if (!name)
    add("name", "Give it a name guests will understand, like “Happy hour”");
  else if (name.length > 40) add("name", "40 characters at most");
  if (
    !Number.isInteger(rule.percentOff) ||
    rule.percentOff < 1 ||
    rule.percentOff > MAX_PERCENT
  )
    add("percentOff", `A whole number from 1 to ${MAX_PERCENT}`);
  if (!(ROUND_STEPS as readonly number[]).includes(rule.roundTo))
    add("roundTo", "Pick a rounding");

  if (rule.scope === "categories" && rule.categoryIds.length === 0)
    add("categoryIds", "Pick at least one category");
  if (rule.scope === "dishes" && rule.dishIds.length === 0)
    add("dishIds", "Pick at least one dish");

  if (rule.startsAt !== null && !STAMP_PATTERN.test(rule.startsAt))
    add("startsAt", "Pick a date and time");
  if (rule.endsAt !== null && !STAMP_PATTERN.test(rule.endsAt))
    add("endsAt", "Pick a date and time");
  else if (rule.endsAt && rule.startsAt && rule.endsAt <= rule.startsAt)
    add("endsAt", "Must be after the start");

  if (rule.windows.length > MAX_WINDOWS)
    add("windows", `At most ${MAX_WINDOWS} time slots`);
  rule.windows.forEach((w, i) => {
    if (w.days.length === 0) add(`windows.${i}.days`, "Pick at least one day");
    if (!TIME_PATTERN.test(w.from)) add(`windows.${i}.from`, "Pick a time");
    if (!TIME_PATTERN.test(w.to)) add(`windows.${i}.to`, "Pick a time");
    else if (w.from === w.to) add(`windows.${i}.to`, "Ends when it starts");
  });
  return issues;
}

export function daysLabel(days: Day[]): string {
  const sorted = DAYS.filter((d) => days.includes(d));
  if (sorted.length === 7) return "Every day";
  const idx = sorted.map((d) => DAYS.indexOf(d));
  const consecutive =
    idx.length > 2 && idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (consecutive)
    return `${dayShort(sorted[0])}–${dayShort(sorted[sorted.length - 1])}`;
  return sorted.map(dayShort).join(", ");
}

export const windowsLabel = (windows: PromotionWindow[]) =>
  windows.length === 0
    ? "All day"
    : windows.map((w) => `${daysLabel(w.days)} ${w.from}–${w.to}`).join(" · ");

export function whenLabel(
  stamp: string,
  timezone: string,
  now: Date = new Date(),
  kind: "start" | "end" = "start",
): string {
  const today = localClock(timezone, now).date;
  let date = stamp.slice(0, 10);
  const time = stamp.slice(11);
  const dayLabel = (d: string) =>
    d === today
      ? "today"
      : d === addDays(today, 1).date
        ? "tomorrow"
        : new Intl.DateTimeFormat("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          }).format(new Date(`${d}T12:00:00Z`));

  if (kind === "end" && (time === "00:00" || time === "23:59")) {
    if (time === "00:00") date = addDays(date, -1).date;
    return date === today ? "midnight" : `the end of ${dayLabel(date)}`;
  }
  if (kind === "start" && time === "00:00") return dayLabel(date);
  return `${dayLabel(date)} at ${time}`;
}
