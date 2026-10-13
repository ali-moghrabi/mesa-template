import {
  addDays,
  dayShort,
  fromMinutes,
  restaurantClock,
  shiftSpan,
  shiftsOn,
  type OpeningHours,
} from './opening-hours';

export const ORDER_TYPES = ['delivery', 'pickup'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const PAYMENT_METHODS = ['card', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type DeliveryArea = {
  id: string;
  name: string;
  fee?: number;
  minimumOrder?: number;
};

export type OrderingRules = {
  enabled: boolean;
  currency: string;
  timezone: string;
  vat: { rate: number; included: boolean };
  payments: { card: boolean; cash: boolean };
  delivery: null | {
    fee: number;
    freeOver: number | null;
    minimumOrder: number;
    etaMinutes: [number, number];
    areas: DeliveryArea[];
  };
  pickup: null | {
    etaMinutes: [number, number];
    address: string;
    instructions: string;
  };
  scheduling: { enabled: boolean; daysAhead: number; slotMinutes: number };
  tips: number[];
};

export type Quote = {
  subtotal: number;
  savings: number;
  deliveryFee: number;
  deliveryWaived: number;
  tip: number;
  vat: number;
  vatIncluded: boolean;
  total: number;
  minimumOrder: number;
  belowMinimum: number;
  toFreeDelivery: number | null;
};

export function quote(
  items: { subtotal: number; savings: number },
  type: OrderType,
  rules: Pick<OrderingRules, 'vat' | 'delivery'>,
  options: { areaId?: string; tipPercent?: number } = {},
): Quote {
  const subtotal = Math.max(0, Math.round(items.subtotal));
  const delivery = type === 'delivery' ? rules.delivery : null;
  const area = delivery?.areas.find((a) => a.id === options.areaId);

  const baseFee = delivery ? (area?.fee ?? delivery.fee) : 0;
  const free = delivery?.freeOver != null && subtotal >= delivery.freeOver;
  const deliveryFee = free ? 0 : baseFee;
  const minimumOrder = delivery
    ? (area?.minimumOrder ?? delivery.minimumOrder)
    : 0;

  const tip = Math.round(
    (subtotal * Math.max(0, options.tipPercent ?? 0)) / 100,
  );
  const taxable = subtotal + deliveryFee;
  const rate = rules.vat.rate;
  const vat =
    rate > 0
      ? rules.vat.included
        ? Math.round(taxable - taxable / (1 + rate))
        : Math.round(taxable * rate)
      : 0;

  return {
    subtotal,
    savings: Math.max(0, Math.round(items.savings)),
    deliveryFee,
    deliveryWaived: free ? baseFee : 0,
    tip,
    vat,
    vatIncluded: rules.vat.included,
    total: taxable + tip + (rules.vat.included ? 0 : vat),
    minimumOrder,
    belowMinimum: Math.max(0, minimumOrder - subtotal),
    toFreeDelivery:
      delivery?.freeOver != null && !free && baseFee > 0
        ? delivery.freeOver - subtotal
        : null,
  };
}

export type SlotDay = {
  date: string;
  label: string;
  times: { value: string; label: string }[];
};

export function timeSlots(
  hours: OpeningHours | null,
  {
    daysAhead,
    slotMinutes,
    leadMinutes,
  }: { daysAhead: number; slotMinutes: number; leadMinutes: number },
  now: Date = new Date(),
): SlotDay[] {
  if (!hours) return [];
  const clock = restaurantClock(hours.timezone, now);
  const earliest = clock.minutes + leadMinutes;
  const lastDay = daysAhead * 1440 + 1440;
  const found = new Set<number>();

  for (let k = -1; k <= daysAhead; k++) {
    const day = addDays(clock.date, k);
    for (const shift of shiftsOn(hours, day.date, day.day).shifts) {
      const [open, close] = shiftSpan(shift);
      const start = k * 1440 + open + leadMinutes;
      const end = k * 1440 + close;
      const first =
        Math.ceil(Math.max(start, earliest) / slotMinutes) * slotMinutes;
      for (let t = first; t <= end && t < lastDay; t += slotMinutes)
        found.add(t);
    }
  }

  const days = new Map<string, SlotDay>();
  for (const t of [...found].sort((a, b) => a - b)) {
    const offset = Math.floor(t / 1440);
    const day = addDays(clock.date, offset);
    const time = fromMinutes(t);
    let entry = days.get(day.date);
    if (!entry) {
      const label =
        offset === 0
          ? 'Today'
          : offset === 1
            ? 'Tomorrow'
            : `${dayShort(day.day)} ${Number(day.date.slice(8))}`;
      entry = { date: day.date, label, times: [] };
      days.set(day.date, entry);
    }
    entry.times.push({ value: `${day.date}T${time}`, label: time });
  }
  return [...days.values()];
}

export const SLOT_PATTERN = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export function zonedToDate(local: string, timeZone: string): Date {
  const guess = new Date(`${local}:00Z`);
  const offsetAt = (instant: Date) => {
    const c = restaurantClock(timeZone, instant);
    const wall =
      Date.UTC(
        +c.date.slice(0, 4),
        +c.date.slice(5, 7) - 1,
        +c.date.slice(8, 10),
      ) +
      c.minutes * 60_000;
    return wall - Math.floor(instant.getTime() / 60_000) * 60_000;
  };
  const first = new Date(guess.getTime() - offsetAt(guess));
  const second = offsetAt(first);
  return second === offsetAt(guess)
    ? first
    : new Date(guess.getTime() - second);
}

const ZERO_DECIMAL = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

export function toStripeAmount(
  minor: number,
  currency: string,
  priceUnit: number,
): number {
  const stripeUnit = ZERO_DECIMAL.has(currency.toLowerCase()) ? 1 : 100;
  return Math.round((minor * stripeUnit) / priceUnit);
}
