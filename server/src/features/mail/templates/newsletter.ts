import type { Brand } from '../mail.config';
import {
  button,
  divider,
  escapeHtml,
  fallbackLink,
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

export function absoluteUrl(href: string, brand: Brand): string | null {
  const url = href.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${brand.webUrl}${url}`;
  if (/^mailto:|^tel:/i.test(url)) return url;
  return null;
}

export function richText(text: string, brand: Brand): string {
  const inline = (raw: string) =>
    escapeHtml(raw)
      .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${INK};">$1</strong>`)
      .replace(
        /\[([^\]]+)\]\(([^)\s]+)\)/g,
        (_m, label: string, href: string) => {
          const url = absoluteUrl(href.replace(/&amp;/g, '&'), brand);
          return url
            ? `<a href="${escapeHtml(url)}" style="color:${brand.color};text-decoration:underline;">${label}</a>`
            : label;
        },
      )
      .replace(/\n/g, '<br>');

  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
        const items = lines
          .map(
            (l) =>
              `<li style="margin:0 0 6px;">${inline(l.replace(/^\s*[-•]\s+/, ''))}</li>`,
          )
          .join('');
        return `<ul style="margin:0 0 16px;padding-left:22px;font-family:${FONT};font-size:16px;line-height:1.6;color:${INK};">${items}</ul>`;
      }
      if (block.startsWith('## ')) {
        return `<h2 style="margin:8px 0 10px;font-family:${FONT};font-size:19px;line-height:1.3;font-weight:700;color:${INK};">${inline(block.slice(3))}</h2>`;
      }
      return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.65;color:${INK};">${inline(block)}</p>`;
    })
    .join('\n');
}

export const plainText = (text: string, brand: Brand) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_m, label: string, href: string) =>
        `${label} (${absoluteUrl(href, brand) ?? href})`,
    )
    .replace(/^## /gm, '')
    .trim();

export type NewsletterConfirmData = { link: string };

export function newsletterConfirmEmail(
  brand: Brand,
  { link }: NewsletterConfirmData,
): EmailContent {
  const html = renderLayout({
    brand,
    preheader: `One click and you're on the ${brand.name} list.`,
    body: [
      heading('Confirm your subscription'),
      paragraph(
        `Thanks for signing up to the ${brand.name} newsletter: seasonal menus, events and the occasional offer.`,
      ),
      paragraph('Please confirm it was you, and you’re on the list:'),
      button('Yes, subscribe me', link, brand.color),
      note(
        'This link works for 7 days. Didn’t sign up? Ignore this email and you won’t hear from us again.',
        { icon: '🔒' },
      ),
      fallbackLink(link),
    ].join('\n'),
    footerNote: `Someone entered this address in the newsletter form on ${brand.webUrl}.`,
  });
  const text = [
    `Confirm your subscription to the ${brand.name} newsletter:`,
    link,
    '',
    'This link works for 7 days. Didn’t sign up? Ignore this email and you won’t hear from us again.',
  ].join('\n');
  return { subject: `Confirm your subscription · ${brand.name}`, html, text };
}

export type NewsletterWelcomeData = {
  unsubscribeLink: string;
  message?: string;
};

const unsubscribeLine = (link: string) =>
  `<p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">Don't want these emails? <a href="${escapeHtml(link)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a> in one click.</p>`;

export function newsletterWelcomeEmail(
  brand: Brand,
  { unsubscribeLink, message }: NewsletterWelcomeData,
): EmailContent {
  const extra = message?.trim();
  const html = renderLayout({
    brand,
    preheader: extra
      ? extra.replace(/\s+/g, ' ').slice(0, 110)
      : 'Seasonal menus, events and offers, a few times a month at most.',
    body: [
      heading('You’re on the list 🎉'),
      paragraph(
        `Welcome to the ${brand.name} newsletter. Here’s what to expect:`,
      ),
      note(
        '<strong>New dishes and seasonal menus</strong>, before anyone else',
        { icon: '🍽' },
      ),
      note('<strong>Events</strong>: live music, tastings, special nights', {
        icon: '🎶',
      }),
      note('<strong>Offers</strong> just for subscribers, now and then', {
        icon: '🎁',
      }),
      extra
        ? `<div style="margin:4px 0 20px;padding:18px 20px;border:2px dashed ${brand.color};border-radius:16px;">${richText(extra, brand).replace(/margin:0 0 16px/g, 'margin:0 0 8px')}</div>`
        : '',
      paragraph(
        'A few emails a month at most. No spam, and we never share your address.',
        { muted: true },
      ),
      button(`Visit ${brand.name}`, brand.webUrl, brand.color),
      divider(),
      unsubscribeLine(unsubscribeLink),
    ].join('\n'),
    footerNote: `You're receiving this because you subscribed on ${brand.webUrl}.`,
  });
  const text = [
    `You're on the ${brand.name} list!`,
    '',
    'New dishes and seasonal menus, events, and offers just for subscribers. A few emails a month at most.',
    ...(extra ? ['', plainText(extra, brand)] : []),
    '',
    brand.webUrl,
    '',
    `Unsubscribe: ${unsubscribeLink}`,
  ].join('\n');
  return { subject: `Welcome to the ${brand.name} newsletter`, html, text };
}

export type EmailDish = {
  name: string;
  image?: string;
  price: string;
  was?: string;
  badge?: string;
  link: string;
};

export type CampaignEmailData = {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  button?: { label: string; url: string };
  dishes: EmailDish[];
  unsubscribeLink: string;
};

function dishCard(d: EmailDish): string {
  const photo = d.image
    ? `<a href="${escapeHtml(d.link)}" target="_blank"><img src="${escapeHtml(d.image)}" alt="${escapeHtml(d.name)}" width="232" style="display:block;width:100%;height:auto;max-height:170px;object-fit:cover;border:0;border-radius:14px 14px 0 0;"></a>`
    : `<div style="height:8px;"></div>`;
  const badge = d.badge
    ? `<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:#DCFCE7;color:#166534;font-size:12px;font-weight:700;">${escapeHtml(d.badge)}</span>`
    : '';
  const was = d.was
    ? `<span style="margin-left:6px;color:${MUTED};text-decoration:line-through;font-weight:400;">${escapeHtml(d.was)}</span>`
    : '';
  return `<td valign="top" width="50%" style="padding:6px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:16px;background:#ffffff;">
    <tr><td style="padding:0;">${photo}</td></tr>
    <tr><td style="padding:12px 14px 14px;font-family:${FONT};">
      <a href="${escapeHtml(d.link)}" target="_blank" style="display:block;font-size:15px;line-height:1.35;font-weight:700;color:${INK};text-decoration:none;">${escapeHtml(d.name)}</a>
      <p style="margin:6px 0 0;font-size:15px;font-weight:700;color:${INK};">${escapeHtml(d.price)}${was}${badge}</p>
    </td></tr>
  </table>
</td>`;
}

function dishGrid(dishes: EmailDish[]): string {
  if (!dishes.length) return '';
  const rows: string[] = [];
  for (let i = 0; i < dishes.length; i += 2) {
    const pair = dishes.slice(i, i + 2);
    rows.push(
      `<tr>${pair.map(dishCard).join('')}${pair.length === 1 ? '<td width="50%" style="padding:6px;"></td>' : ''}</tr>`,
    );
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px -6px 20px;width:calc(100% + 12px);">${rows.join('')}</table>`;
}

export function campaignEmail(
  brand: Brand,
  data: CampaignEmailData,
): EmailContent {
  const link = data.button ? absoluteUrl(data.button.url, brand) : null;
  const html = renderLayout({
    brand,
    preheader: data.preheader || data.body.replace(/\s+/g, ' ').slice(0, 110),
    body: [
      data.heading ? heading(data.heading) : '',
      richText(data.body, brand),
      dishGrid(data.dishes),
      data.button && link ? button(data.button.label, link, brand.color) : '',
      divider(),
      `<p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">You're getting this because you subscribed to the ${escapeHtml(brand.name)} newsletter. <a href="${escapeHtml(data.unsubscribeLink)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a> in one click.</p>`,
    ].join('\n'),
    footerNote: `${brand.name} newsletter`,
  });
  const text = [
    data.heading,
    '',
    plainText(data.body, brand),
    ...(data.dishes.length
      ? [
          '',
          ...data.dishes.map(
            (d) =>
              `• ${d.name}: ${d.price}${d.was ? ` (was ${d.was})` : ''} ${d.link}`,
          ),
        ]
      : []),
    ...(data.button && link ? ['', `${data.button.label}: ${link}`] : []),
    '',
    `Unsubscribe: ${data.unsubscribeLink}`,
  ]
    .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
    .join('\n')
    .trim();
  return { subject: data.subject, html, text };
}
