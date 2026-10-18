import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional().default('');
const url = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || /^https?:\/\/\S+$/i.test(v),
    'Use a full link starting with https://',
  )
  .optional()
  .default('');
const money = z.number().min(0).max(100_000).optional();
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 09:30');

export const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const day = z.object({
  closed: z.boolean(),
  shifts: z.array(z.object({ open: time, close: time })).max(2),
});

export const onboardingSchema = z.object({
  restaurant: z.object({
    name: text(80).min(2, 'Add the restaurant name'),
    type: z.enum(['Restaurant', 'Cafe', 'Bar', 'Bakery', 'FastFood', 'Other']),
    cuisine: z.array(text(40)).min(1, 'Add at least one cuisine').max(6),
    priceRange: z.enum(['$', '$$', '$$$', '$$$$']),
    description: text(600).min(
      20,
      'Tell guests a little about the place (a sentence or two)',
    ),
    tagline: optionalText(120),
    since: optionalText(10),
  }),
  contact: z.object({
    mapsLink: url,
    /** "33.8962, 35.4823" from Google Maps (the web form requires it) */
    location: optionalText(120),
    street: optionalText(160),
    area: optionalText(80),
    city: text(80).min(2, 'Add the city'),
    country: text(80).min(2, 'Add the country'),
    phone: text(30).min(6, 'Add a phone number'),
    whatsapp: optionalText(30),
    email: z.string().trim().email('Add a valid email').max(200),
    instagram: url,
    facebook: url,
    tiktok: url,
    legalName: optionalText(120),
  }),
  brand: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour'),
    mode: z.enum(['light', 'dark']),
  }),
  hours: z.object(
    Object.fromEntries(DAYS.map((d) => [d, day])) as Record<
      (typeof DAYS)[number],
      typeof day
    >,
  ),
  services: z.object({
    reservations: z.boolean(),
    maxPartySize: z.number().int().min(1).max(100).optional(),
    delivery: z.boolean(),
    deliveryFee: money,
    deliveryMinimum: money,
    deliveryFreeOver: money,
    deliveryAreas: optionalText(600),
    pickup: z.boolean(),
    whatsappOrdering: z.boolean(),
    payments: z.array(z.enum(['cash', 'card', 'whish'])).max(3),
    currency: z.enum(['USD', 'LBP', 'EUR', 'AED', 'SAR']),
  }),
  extras: z.object({
    menuLink: url,
    domain: optionalText(120),
    plan: z.enum(['essential', 'pro', 'signature', 'unsure']),
    notes: optionalText(2000),
  }),
  person: z.object({
    name: text(80).min(2, 'Add your name'),
    role: optionalText(60),
    phone: text(30).min(6, 'Add your phone number'),
  }),
});

export type OnboardingAnswers = z.infer<typeof onboardingSchema>;
