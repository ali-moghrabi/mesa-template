import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { toMinor } from 'lib/money';
import {
  fromLegacyConfig,
  isValidTimeZone,
  type OpeningHours,
} from 'lib/opening-hours';
import type { DeliveryArea, OrderingRules } from 'lib/ordering';
import type { ReservationRules } from 'lib/reservations';
import type { Env } from 'src/config/env';

type Json = Record<string, unknown>;

export type SiteSettings = {
  rules: OrderingRules;
  reservations: ReservationRules;
  contact: ContactSettings;
  newsletter: { enabled: boolean };
  brandName: string;
  configHours: OpeningHours | null;
};

@Injectable()
export class OrderingConfig {
  private readonly logger = new Logger(OrderingConfig.name);
  private cached?: { mtime: number; value: SiteSettings };

  constructor(private readonly config: ConfigService<Env, true>) {}

  settings(): SiteSettings {
    const raw: unknown = this.config.get('SITE_CONFIG_PATH', { infer: true });
    const path = typeof raw === 'string' && raw.trim() ? raw.trim() : '';
    if (!path) {
      this.logger.warn('SITE_CONFIG_PATH is not set: online ordering is off');
      return normalize({});
    }
    const file = isAbsolute(path) ? path : resolve(process.cwd(), path);
    try {
      const mtime = statSync(file).mtimeMs;
      if (this.cached && this.cached.mtime === mtime) return this.cached.value;
      const value = normalize(JSON.parse(readFileSync(file, 'utf8')) as Json);
      this.cached = { mtime, value };
      return value;
    } catch (error) {
      this.logger.error(`Couldn't read ${file}: ${(error as Error).message}`);
      return this.cached?.value ?? normalize({});
    }
  }

  rules(): OrderingRules {
    return this.settings().rules;
  }

  reservationRules(): ReservationRules {
    return this.settings().reservations;
  }

  contact(): ContactSettings {
    return this.settings().contact;
  }
}

export type ContactSettings = {
  enabled: boolean;
  subjects: string[];
  recipient: string;
};

function contactSettings(config: Json): ContactSettings {
  const pages = obj(config.pages);
  let subjects: string[] = [];
  for (const page of Object.values(pages)) {
    const sections = obj(page).sections;
    if (!Array.isArray(sections)) continue;
    const contact = sections.map(obj).find((s) => s.type === 'contact');
    const list = obj(contact?.props).subjects;
    if (Array.isArray(list)) {
      subjects = list
        .map((x) => str(x))
        .filter((x) => x && x.length <= 80)
        .slice(0, 20);
      break;
    }
  }
  const recipient =
    str(obj(obj(config.integrations).emailProvider).formsRecipient) ||
    str(obj(config.business).email);
  return {
    enabled: obj(config.features).contactForm === true,
    subjects,
    recipient: /^[^\s@]+@[^\s@]+$/.test(recipient) ? recipient : '',
  };
}

function reservationRules(config: Json, timezone: string): ReservationRules {
  const page = obj(obj(config.pages).reservations);
  const r = obj(obj(config.business).reservations);
  const maxPartySize = Math.round(num(r.maxPartySize, 10, 1, 100));
  const occasions = (Array.isArray(r.occasions) ? r.occasions : [])
    .map((o) => str(o))
    .filter((o) => o && o.length <= 40)
    .slice(0, 12);
  const cap = num(r.maxCoversPerSlot, 0, 0, 10_000);
  return {
    enabled:
      obj(config.features).reservations === true && page.enabled === true,
    timezone,
    minPartySize: Math.min(
      maxPartySize,
      Math.round(num(r.minPartySize, 1, 1, 100)),
    ),
    maxPartySize,
    slotMinutes: [15, 20, 30, 45, 60].includes(num(r.slotIntervalMinutes, 30))
      ? num(r.slotIntervalMinutes, 30)
      : 30,
    advanceDays: Math.round(num(r.advanceDays, 30, 1, 365)),
    minNoticeMinutes: Math.round(num(r.minNoticeHours, 2, 0, 72) * 60),
    lastSeatingMinutes: Math.round(num(r.lastSeatingMinutes, 60, 0, 240)),
    durationMinutes: Math.round(num(r.durationMinutes, 90, 15, 480)),
    maxCoversPerSlot: cap > 0 ? Math.round(cap) : null,
    requirePhone: bool(r.requirePhone, true),
    allowSpecialRequests: bool(r.allowSpecialRequests, true),
    occasions,
    confirmationMessage:
      str(r.confirmationMessage) ||
      "Thanks! We've received your request and will confirm it by email shortly.",
  };
}

export const PAYMENT_METHOD_IDS = ['cod', 'stripe'] as const;
export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

function paymentMethods(payments: Json): OrderingRules['payments'] {
  const methods = payments.methods;
  if (!Array.isArray(methods)) return { card: true, cash: true };
  const ids = new Set(
    methods
      .filter((m): m is string => typeof m === 'string')
      .map((m) => m.trim().toLowerCase()),
  );
  return { card: ids.has('stripe'), cash: ids.has('cod') };
}

function addressLine(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  const a = obj(value);
  return [a.street, a.city, a.region, a.postalCode, a.country]
    .map((part) => str(part))
    .filter(Boolean)
    .join(', ');
}

const obj = (v: unknown): Json =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {};
const bool = (v: unknown, fallback: boolean) =>
  typeof v === 'boolean' ? v : fallback;
const num = (
  v: unknown,
  fallback: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : fallback;
const str = (v: unknown, fallback = '') =>
  typeof v === 'string' ? v.trim() : fallback;
const money = (v: unknown, fallback = 0) =>
  toMinor(num(v, fallback, 0, 100_000));
const range = (v: unknown, fallback: [number, number]): [number, number] => {
  if (!Array.isArray(v) || v.length !== 2) return fallback;
  const a = num(v[0], fallback[0], 0, 600);
  const b = num(v[1], fallback[1], 0, 600);
  return a <= b ? [a, b] : [b, a];
};

function normalize(config: Json): SiteSettings {
  const features = obj(config.features);
  const menu = obj(config.menu);
  const pricing = obj(menu.pricing);
  const business = obj(config.business);
  const ordering = obj(config.ordering);
  const payments = obj(ordering.payments);
  const delivery = obj(ordering.delivery);
  const pickup = obj(ordering.pickup);
  const scheduling = obj(ordering.scheduling);

  const timezone = isValidTimeZone(str(business.timezone))
    ? str(business.timezone)
    : 'UTC';
  const areas: DeliveryArea[] = (
    Array.isArray(delivery.areas) ? delivery.areas : []
  )
    .map(obj)
    .filter((a) => str(a.id) && str(a.name))
    .slice(0, 100)
    .map((a) => ({
      id: str(a.id),
      name: str(a.name),
      ...(typeof a.fee === 'number' && { fee: money(a.fee) }),
      ...(typeof a.minimumOrder === 'number' && {
        minimumOrder: money(a.minimumOrder),
      }),
    }));

  const rules: OrderingRules = {
    enabled: features.onlineOrdering === true,
    currency: (
      str(obj(obj(menu.currency).primary).code) || 'USD'
    ).toUpperCase(),
    timezone,
    vat: {
      rate: num(pricing.vatRate, 0, 0, 1),
      included: bool(pricing.taxIncluded, true),
    },
    payments: paymentMethods(payments),
    delivery:
      features.delivery === true
        ? {
            fee: money(delivery.fee),
            freeOver:
              typeof delivery.freeOver === 'number' && delivery.freeOver > 0
                ? money(delivery.freeOver)
                : null,
            minimumOrder: money(delivery.minimumOrder),
            etaMinutes: range(delivery.etaMinutes, [35, 50]),
            areas,
          }
        : null,
    pickup:
      features.pickup === true
        ? {
            etaMinutes: range(pickup.etaMinutes, [15, 25]),
            address: str(pickup.address) || addressLine(business.address),
            instructions: str(pickup.instructions),
          }
        : null,
    scheduling: {
      enabled: bool(scheduling.enabled, true),
      daysAhead: Math.round(num(scheduling.daysAhead, 2, 0, 14)),
      slotMinutes: [5, 10, 15, 20, 30, 60].includes(
        num(scheduling.slotMinutes, 15),
      )
        ? num(scheduling.slotMinutes, 15)
        : 15,
    },
    tips: (Array.isArray(ordering.tips) ? ordering.tips : [])
      .filter((t): t is number => typeof t === 'number' && t >= 0 && t <= 50)
      .map((t) => Math.round(t))
      .slice(0, 5),
  };

  const legacy = {
    timezone,
    hours: business.hours as never,
    specialHours: business.specialHours as never,
  };
  return {
    rules,
    reservations: reservationRules(config, timezone),
    contact: contactSettings(config),
    newsletter: { enabled: features.newsletter === true },
    brandName: str(obj(config.brand).name) || 'Our restaurant',
    configHours: Array.isArray(business.hours)
      ? fromLegacyConfig(legacy)
      : null,
  };
}
