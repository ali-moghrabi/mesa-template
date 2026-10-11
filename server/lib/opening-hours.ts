export const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type Day = (typeof DAYS)[number];

export type Shift = { open: string; close: string };
export type DayHours = { day: Day; shifts: Shift[] };
export type SpecialDay = { date: string; label: string; shifts: Shift[] };
export type OpeningHours = {
  timezone: string;
  weekly: DayHours[];
  exceptions: SpecialDay[];
};

export const MAX_SHIFTS = 3;
export const MAX_SPECIAL_DAYS = 60;
export const MAX_LABEL = 60;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const DAY_NAMES: Record<Day, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};
export const dayName = (day: Day) => DAY_NAMES[day];
export const dayShort = (day: Day) => DAY_NAMES[day].slice(0, 3);

export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function shiftSpan(shift: Shift): [number, number] {
  const open = toMinutes(shift.open);
  let close = toMinutes(shift.close);
  if (close <= open) close += 1440;
  return [open, close];
}

export const runsPastMidnight = (shift: Shift) =>
  toMinutes(shift.close) <= toMinutes(shift.open) && shift.close !== '00:00';

export const shiftsLabel = (shifts: Shift[]) =>
  shifts.length === 0
    ? 'Closed'
    : sortShifts(shifts)
        .map((s) => `${s.open}–${s.close}`)
        .join(', ');

export const sortShifts = (shifts: Shift[]) =>
  [...shifts].sort((a, b) => toMinutes(a.open) - toMinutes(b.open));

export function hoursIssues(hours: OpeningHours): Record<string, string> {
  const issues: Record<string, string> = {};
  const add = (path: string, message: string) => {
    issues[path] ??= message;
  };

  if (!isValidTimeZone(hours.timezone))
    add('timezone', 'Pick a time zone from the list');

  if (
    hours.weekly.length !== 7 ||
    DAYS.some((day, i) => hours.weekly[i]?.day !== day)
  )
    add('weekly', 'Give all 7 days, Monday to Sunday');

  hours.weekly.forEach((day, i) => checkShifts(day.shifts, `weekly.${i}`, add));

  hours.weekly.forEach((day, i) => {
    const late = Math.max(0, ...day.shifts.map((s) => shiftSpan(s)[1] - 1440));
    if (late <= 0) return;
    const next = hours.weekly[(i + 1) % 7];
    next?.shifts.forEach((shift, j) => {
      if (toMinutes(shift.open) < late)
        add(
          `weekly.${(i + 1) % 7}.shifts.${j}.open`,
          `${dayName(day.day)} is still open until ${fromMinutes(late)}`,
        );
    });
  });

  if (hours.exceptions.length > MAX_SPECIAL_DAYS)
    add('exceptions', `At most ${MAX_SPECIAL_DAYS} special days`);
  const seen = new Map<string, number>();
  hours.exceptions.forEach((special, i) => {
    if (!DATE_PATTERN.test(special.date) || !isRealDate(special.date))
      add(`exceptions.${i}.date`, 'Pick a date');
    else if (seen.has(special.date))
      add(`exceptions.${i}.date`, 'This date is already on the list');
    else seen.set(special.date, i);
    const label = special.label.trim();
    if (!label) add(`exceptions.${i}.label`, 'Name it, like “Christmas Day”');
    else if (label.length > MAX_LABEL)
      add(`exceptions.${i}.label`, `${MAX_LABEL} characters at most`);
    checkShifts(special.shifts, `exceptions.${i}`, add);
  });

  return issues;
}

function checkShifts(
  shifts: Shift[],
  base: string,
  add: (path: string, message: string) => void,
) {
  if (shifts.length > MAX_SHIFTS)
    add(`${base}.shifts`, `At most ${MAX_SHIFTS} shifts a day`);
  shifts.forEach((shift, j) => {
    if (!TIME_PATTERN.test(shift.open))
      add(`${base}.shifts.${j}.open`, 'Pick a time');
    if (!TIME_PATTERN.test(shift.close))
      add(`${base}.shifts.${j}.close`, 'Pick a time');
    else if (shift.open === shift.close)
      add(`${base}.shifts.${j}.close`, 'Closes when it opens');
  });
  if (
    !shifts.every(
      (s) => TIME_PATTERN.test(s.open) && TIME_PATTERN.test(s.close),
    )
  )
    return;

  const ordered = shifts
    .map((shift, j) => ({ j, shift, span: shiftSpan(shift) }))
    .filter(({ shift }) => shift.open !== shift.close)
    .sort((a, b) => a.span[0] - b.span[0]);
  for (let k = 1; k < ordered.length; k++) {
    const before = ordered[k - 1];
    if (ordered[k].span[0] < before.span[1])
      add(
        `${base}.shifts.${ordered[k].j}.open`,
        `Overlaps ${fromMinutes(before.span[0])}–${fromMinutes(before.span[1])}`,
      );
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const isRealDate = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
};

export type OpenStatus = {
  open: boolean;
  label: string;
  closingSoon: boolean;
  special?: string;
};

export function restaurantClock(timeZone: string, now: Date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: parts.weekday.toLowerCase() as Day,
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

export function addDays(
  date: string,
  days: number,
): { date: string; day: Day } {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return {
    date: d.toISOString().slice(0, 10),
    day: DAYS[(d.getUTCDay() + 6) % 7],
  };
}

export function shiftsOn(
  hours: OpeningHours,
  date: string,
  day: Day,
): { shifts: Shift[]; special?: SpecialDay } {
  const special = hours.exceptions.find((e) => e.date === date);
  if (special) return { shifts: special.shifts, special };
  return { shifts: hours.weekly.find((w) => w.day === day)?.shifts ?? [] };
}

export function getOpenStatus(
  hours: OpeningHours,
  now: Date = new Date(),
): OpenStatus {
  const clock = restaurantClock(hours.timezone, now);
  const today = shiftsOn(hours, clock.date, clock.day);
  const yesterday = addDays(clock.date, -1);
  const before = shiftsOn(hours, yesterday.date, yesterday.day);
  const special = today.special?.label;

  const openUntil = (close: number): OpenStatus => ({
    open: true,
    label: `Open until ${fromMinutes(close)}`,
    closingSoon: close - clock.minutes <= 30,
    special,
  });

  for (const shift of before.shifts) {
    const [, close] = shiftSpan(shift);
    if (close > 1440 && clock.minutes < close - 1440)
      return openUntil(close - 1440);
  }

  const spans = sortShifts(today.shifts).map(shiftSpan);
  const current = spans.find(
    ([open, close]) => clock.minutes >= open && clock.minutes < close,
  );
  if (current) return openUntil(current[1]);

  const later = spans.find(([open]) => open > clock.minutes);
  if (later) {
    const again = spans.some(([, close]) => close <= clock.minutes);
    return {
      open: false,
      label: `Closed, ${again ? 'back' : 'opens today'} at ${fromMinutes(later[0])}`,
      closingSoon: false,
      special,
    };
  }

  for (let k = 1; k <= 14; k++) {
    const next = addDays(clock.date, k);
    const first = sortShifts(shiftsOn(hours, next.date, next.day).shifts)[0];
    if (!first) continue;
    const when =
      k === 1
        ? 'tomorrow'
        : k < 7
          ? dayName(next.day)
          : `on ${dayShort(next.day)} ${Number(next.date.slice(8))}`;
    return {
      open: false,
      label: `Closed, opens ${when} at ${first.open}`,
      closingSoon: false,
      special,
    };
  }
  return { open: false, label: 'Closed', closingSoon: false, special };
}

export function groupWeekly(
  weekly: DayHours[],
): { days: string; hours: string; closed: boolean }[] {
  const groups: { from: Day; to: Day; hours: string; closed: boolean }[] = [];
  for (const day of DAYS) {
    const shifts = weekly.find((w) => w.day === day)?.shifts ?? [];
    const label = shiftsLabel(shifts);
    const last = groups[groups.length - 1];
    if (last && last.hours === label) last.to = day;
    else
      groups.push({
        from: day,
        to: day,
        hours: label,
        closed: shifts.length === 0,
      });
  }
  return groups.map((g) => ({
    days:
      g.from === g.to
        ? dayShort(g.from)
        : `${dayShort(g.from)} – ${dayShort(g.to)}`,
    hours: g.hours,
    closed: g.closed,
  }));
}

type LegacyRule = { open?: string; close?: string; closed?: boolean };

export function fromLegacyConfig(business: {
  timezone: string;
  hours?: (LegacyRule & { day: string })[];
  specialHours?: (LegacyRule & { date: string; label: string })[];
}): OpeningHours {
  const toShifts = (rule?: LegacyRule): Shift[] =>
    rule && !rule.closed && rule.open && rule.close
      ? [{ open: rule.open, close: rule.close }]
      : [];
  return {
    timezone: business.timezone,
    weekly: DAYS.map((day) => ({
      day,
      shifts: toShifts(business.hours?.find((h) => h.day === day)),
    })),
    exceptions: (business.specialHours ?? []).map((s) => ({
      date: s.date,
      label: s.label,
      shifts: toShifts(s),
    })),
  };
}
