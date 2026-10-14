import {
  addDays,
  fromMinutes,
  restaurantClock,
  shiftSpan,
  shiftsOn,
  type OpeningHours,
  type Shift,
} from './opening-hours';

export const RESERVATION_STATUSES = [
  'pending',
  'confirmed',
  'seated',
  'declined',
  'cancelled',
  'completed',
  'no_show',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  'pending',
  'confirmed',
  'seated',
];
export const CANCELLABLE_STATUSES: ReservationStatus[] = [
  'pending',
  'confirmed',
];

export const RESERVATION_SOURCES = ['online', 'phone', 'walk_in'] as const;
export type ReservationSource = (typeof RESERVATION_SOURCES)[number];

/**
 * The moves the team can make (admin panel). Mirrored on the website (admin/lib/reservations.ts).
 *   pending    → confirmed | declined | cancelled
 *   confirmed  → seated | no_show | cancelled | pending (undo)
 *   seated     → completed | confirmed (undo "arrived")
 *   completed  → seated (undo)
 *   no_show    → confirmed (they came after all)
 *   declined / cancelled → confirmed (restore, only before the table time)
 */
export const STATUS_MOVES: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ['confirmed', 'declined', 'cancelled'],
  confirmed: ['seated', 'no_show', 'cancelled', 'pending'],
  seated: ['completed', 'confirmed'],
  completed: ['seated'],
  no_show: ['confirmed'],
  declined: ['confirmed'],
  cancelled: ['confirmed'],
};

export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,22}$/;
export const NOTES_MAX = 500;
export const MAX_UPCOMING_PER_GUEST = 3;

export type ReservationRules = {
  enabled: boolean;
  timezone: string;
  minPartySize: number;
  maxPartySize: number;
  slotMinutes: number;
  advanceDays: number;
  minNoticeMinutes: number;
  lastSeatingMinutes: number;
  durationMinutes: number;
  maxCoversPerSlot: number | null;
  requirePhone: boolean;
  allowSpecialRequests: boolean;
  occasions: string[];
  confirmationMessage: string;
};

const FALLBACK_SHIFTS: Shift[] = [{ open: '12:00', close: '23:00' }];

export type BookedSeat = { startsAt: Date; partySize: number };

export type AvailabilityDay = {
  date: string;
  closed: boolean;
  times: { time: string; left: number | null }[];
};

export type Availability = {
  timezone: string;
  today: string;
  days: AvailabilityDay[];
  rules: Omit<
    ReservationRules,
    'enabled' | 'timezone' | 'durationMinutes' | 'lastSeatingMinutes'
  >;
};

export function availability(
  hours: OpeningHours | null,
  rules: ReservationRules,
  booked: BookedSeat[],
  toInstant: (local: string) => Date,
  now: Date = new Date(),
): Availability {
  const timezone = hours?.timezone ?? rules.timezone;
  const clock = restaurantClock(timezone, now);
  const earliest = clock.minutes + rules.minNoticeMinutes;
  const lastMinute = (rules.advanceDays + 1) * 1440;
  const step = rules.slotMinutes;
  const shiftsFor = (date: string, day: Parameters<typeof shiftsOn>[2]) =>
    hours ? shiftsOn(hours, date, day).shifts : FALLBACK_SHIFTS;

  const found = new Set<number>();
  const serviceDays = new Set<number>();
  for (let k = -1; k <= rules.advanceDays; k++) {
    const day = addDays(clock.date, k);
    for (const shift of shiftsFor(day.date, day.day)) {
      const [open, close] = shiftSpan(shift);
      if (k >= 0) serviceDays.add(k);
      const last = Math.max(open, close - rules.lastSeatingMinutes);
      for (let t = Math.ceil(open / step) * step; t <= last; t += step) {
        const at = k * 1440 + t;
        if (at >= earliest && at >= 0 && at < lastMinute) found.add(at);
      }
    }
  }

  const days: AvailabilityDay[] = [];
  for (let k = 0; k <= rules.advanceDays; k++)
    days.push({
      date: addDays(clock.date, k).date,
      closed: !serviceDays.has(k),
      times: [],
    });

  const holdMs = rules.durationMinutes * 60_000;
  for (const at of [...found].sort((a, b) => a - b)) {
    const entry = days[Math.floor(at / 1440)];
    if (!entry) continue;
    const time = fromMinutes(at);
    let left: number | null = null;
    if (rules.maxCoversPerSlot) {
      const start = toInstant(`${entry.date}T${time}`).getTime();
      const taken = booked.reduce(
        (sum, b) =>
          Math.abs(b.startsAt.getTime() - start) < holdMs
            ? sum + b.partySize
            : sum,
        0,
      );
      left = Math.max(0, rules.maxCoversPerSlot - taken);
    }
    entry.times.push({ time, left });
    entry.closed = false;
  }

  return {
    timezone,
    today: clock.date,
    days,
    rules: {
      minPartySize: rules.minPartySize,
      maxPartySize: rules.maxPartySize,
      slotMinutes: rules.slotMinutes,
      advanceDays: rules.advanceDays,
      minNoticeMinutes: rules.minNoticeMinutes,
      maxCoversPerSlot: rules.maxCoversPerSlot,
      requirePhone: rules.requirePhone,
      allowSpecialRequests: rules.allowSpecialRequests,
      occasions: rules.occasions,
      confirmationMessage: rules.confirmationMessage,
    },
  };
}

export function canBook(
  result: Availability,
  date: string,
  time: string,
  partySize: number,
): 'ok' | 'gone' | 'full' {
  const slot = result.days
    .find((d) => d.date === date)
    ?.times.find((t) => t.time === time);
  if (!slot) return 'gone';
  return slot.left !== null && slot.left < partySize ? 'full' : 'ok';
}
