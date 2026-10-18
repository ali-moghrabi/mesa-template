import type { OnboardingAnswers } from 'src/features/onboarding/onboarding.schema';
import { DAYS } from 'src/features/onboarding/onboarding.schema';
import type { Brand } from '../mail.config';
import {
  divider,
  escapeHtml,
  heading,
  note,
  paragraph,
  renderLayout,
  type EmailContent,
} from './layout';

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = '#1F1B16';
const MUTED = '#6B6258';
const LINE = '#EDE6DC';

export type OnboardingFile = {
  kind: 'logo' | 'photo' | 'menu';
  name: string;
  url?: string;
  bytes: number;
};

const PLAN: Record<OnboardingAnswers['extras']['plan'], string> = {
  essential: 'Essential',
  pro: 'Pro',
  signature: 'Signature',
  unsure: 'Not sure yet',
};
const PAY: Record<string, string> = {
  cash: 'Cash',
  card: 'Card (Stripe)',
  whish: 'Whish',
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const yes = (b: boolean) => (b ? 'Yes' : 'No');

/** A titled block of label/value rows */
function table(title: string, rows: [string, string | undefined][]) {
  const body = rows
    .filter(([, v]) => v !== undefined && v !== '')
    .map(
      ([k, v]) => `<tr>
  <td style="padding:7px 12px 7px 0;font-family:${FONT};font-size:13px;color:${MUTED};vertical-align:top;white-space:nowrap;border-bottom:1px solid ${LINE};">${escapeHtml(k)}</td>
  <td style="padding:7px 0;font-family:${FONT};font-size:14px;color:${INK};vertical-align:top;border-bottom:1px solid ${LINE};">${v}</td>
</tr>`,
    )
    .join('');
  return `<p style="margin:22px 0 6px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED};">${escapeHtml(title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>`;
}

const e = (v: string | undefined) => (v ? escapeHtml(v) : undefined);
const link = (href: string | undefined) =>
  href
    ? `<a href="${escapeHtml(href)}" style="color:#B4532A;">${escapeHtml(href.replace(/^https?:\/\/(www\.)?/, ''))}</a>`
    : undefined;
const swatch = (hex: string) =>
  `<span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${hex};vertical-align:-2px;margin-right:6px;border:1px solid rgba(0,0,0,.1);"></span>${escapeHtml(hex)}`;

function hoursText(a: OnboardingAnswers) {
  return DAYS.map((d) => {
    const day = a.hours[d];
    const value =
      day.closed || day.shifts.length === 0
        ? 'Closed'
        : day.shifts.map((s) => `${s.open}–${s.close}`).join(', ');
    return [cap(d).slice(0, 3), value] as [string, string];
  });
}

/* ───────────── to the MESA team ───────────── */

export function onboardingTeamEmail(
  brand: Brand,
  {
    id,
    answers: a,
    files,
  }: { id: string; answers: OnboardingAnswers; files: OnboardingFile[] },
): EmailContent {
  const s = a.services;
  const fileList = files.length
    ? files
        .map(
          (f) =>
            `${f.url ? `<a href="${escapeHtml(f.url)}" style="color:#B4532A;">${escapeHtml(f.name)}</a>` : `${escapeHtml(f.name)} (attached)`} <span style="color:${MUTED};">${Math.max(1, Math.round(f.bytes / 1024))} KB</span>`,
        )
        .join('<br>')
    : 'No files';

  const html = renderLayout({
    brand,
    preheader: `${a.restaurant.name} · ${a.contact.city} · plan: ${PLAN[a.extras.plan]}`,
    body: [
      `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${brand.color};">New client onboarding</p>`,
      heading(a.restaurant.name),
      note(
        `<strong style="color:${INK};">${escapeHtml(a.person.name)}</strong>${a.person.role ? ` · ${escapeHtml(a.person.role)}` : ''}<br>${escapeHtml(a.person.phone)} · ${escapeHtml(a.contact.email)}`,
        { icon: '👤' },
      ),
      paragraph(
        'config.json (a draft built from these answers) and answers.json are attached. Reply to this email to answer the client.',
        { muted: true },
      ),
      table('Restaurant', [
        ['Type', e(a.restaurant.type)],
        ['Cuisine', e(a.restaurant.cuisine.join(', '))],
        ['Price range', e(a.restaurant.priceRange)],
        ['Tagline', e(a.restaurant.tagline)],
        ['About', e(a.restaurant.description)],
        ['Since', e(a.restaurant.since)],
      ]),
      table('Contact & location', [
        [
          'Address',
          e(
            [
              a.contact.street,
              a.contact.area,
              a.contact.city,
              a.contact.country,
            ]
              .filter(Boolean)
              .join(', '),
          ),
        ],
        [
          'Location',
          a.contact.location
            ? link(
                `https://maps.google.com/?q=${encodeURIComponent(a.contact.location.replace(/\s+/g, ''))}`,
              )?.replace(/>[^<]*</, `>${escapeHtml(a.contact.location)}<`)
            : undefined,
        ],
        ['Google Maps', link(a.contact.mapsLink)],
        ['Phone', e(a.contact.phone)],
        ['WhatsApp', e(a.contact.whatsapp)],
        ['Email', e(a.contact.email)],
        ['Instagram', link(a.contact.instagram)],
        ['Facebook', link(a.contact.facebook)],
        ['TikTok', link(a.contact.tiktok)],
        ['Legal name', e(a.contact.legalName)],
      ]),
      table('Look', [
        ['Primary colour', swatch(a.brand.primaryColor)],
        ['Theme', cap(a.brand.mode)],
      ]),
      table('Opening hours', hoursText(a)),
      table('Services', [
        [
          'Reservations',
          `${yes(s.reservations)}${s.reservations && s.maxPartySize ? ` · up to ${s.maxPartySize} guests online` : ''}`,
        ],
        [
          'Delivery',
          s.delivery
            ? `Yes · fee ${s.deliveryFee ?? '-'} · minimum ${s.deliveryMinimum ?? '-'}${s.deliveryFreeOver ? ` · free over ${s.deliveryFreeOver}` : ''}`
            : 'No',
        ],
        ['Delivery areas', s.delivery ? e(s.deliveryAreas) : undefined],
        ['Pickup', yes(s.pickup)],
        ['WhatsApp ordering', yes(s.whatsappOrdering)],
        [
          'Payments',
          e(s.payments.map((p) => PAY[p]).join(', ') || 'None chosen'),
        ],
        ['Currency', e(s.currency)],
      ]),
      table('Menu & extras', [
        ['Menu link', link(a.extras.menuLink)],
        ['Domain', e(a.extras.domain || 'Needs one')],
        ['Plan', e(PLAN[a.extras.plan])],
        ['Notes', e(a.extras.notes)],
      ]),
      table('Files', [['Uploads', fileList]]),
      divider(),
      paragraph(`Reference: ${id}`, { muted: true }),
    ].join('\n'),
    footerNote: 'Sent by the MESA onboarding form.',
  });

  const text = [
    `New client onboarding: ${a.restaurant.name}`,
    `${a.person.name} · ${a.person.phone} · ${a.contact.email}`,
    `${a.restaurant.cuisine.join(', ')} · ${a.contact.city}, ${a.contact.country}`,
    `Primary colour: ${a.brand.primaryColor} (${a.brand.mode})`,
    `Plan: ${PLAN[a.extras.plan]}`,
    '',
    ...files.map((f) => `${f.kind}: ${f.url ?? `${f.name} (attached)`}`),
    '',
    `Reference: ${id}. config.json and answers.json are attached.`,
  ].join('\n');

  return {
    subject: `New client: ${a.restaurant.name} (${a.contact.city})`,
    html,
    text,
  };
}

/* ───────────── to the client ───────────── */

export function onboardingClientEmail(
  brand: Brand,
  { answers: a }: { answers: OnboardingAnswers },
): EmailContent {
  const first = a.person.name.split(' ')[0] || 'there';
  const html = renderLayout({
    brand,
    preheader: `We received everything for ${a.restaurant.name}'s new website.`,
    body: [
      heading(`Thank you, ${first}!`),
      paragraph(
        `We received ${a.restaurant.name}'s details, photos and preferences. Here's what happens next:`,
      ),
      note(
        `<strong style="color:${INK};">1.</strong> We design your website with your colour and photos.<br>
<strong style="color:${INK};">2.</strong> We send you a private preview link to review.<br>
<strong style="color:${INK};">3.</strong> Once you're happy, your site goes live and we show you the admin panel.`,
        { icon: '✨' },
      ),
      paragraph('Want to change or add something? Just reply to this email.', {
        muted: true,
      }),
    ].join('\n'),
    footerNote: `You received this email because you filled in the MESA onboarding form for ${a.restaurant.name}.`,
  });
  const text = [
    `Thank you, ${first}!`,
    '',
    `We received ${a.restaurant.name}'s details, photos and preferences.`,
    '1. We design your website with your colour and photos.',
    '2. We send you a private preview link to review.',
    "3. Once you're happy, your site goes live and we show you the admin panel.",
    '',
    'Want to change or add something? Just reply to this email.',
  ].join('\n');
  return {
    subject: `We got your details · ${a.restaurant.name} × MESA`,
    html,
    text,
  };
}
