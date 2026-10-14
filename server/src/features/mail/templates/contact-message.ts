import type { MessageSummary } from 'src/features/messages/messages.service';
import type { Brand } from '../mail.config';
import {
  button,
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
const PAGE = '#F6F2EC';

const lines = (text: string) => escapeHtml(text).replace(/\n/g, '<br>');
const quote = (text: string) =>
  `<div style="margin:0 0 20px;padding:14px 16px;border-left:3px solid #E8DFD3;background:${PAGE};border-radius:0 12px 12px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};">${lines(text)}</div>`;

export type ContactNotificationData = {
  message: MessageSummary;
  body: string;
  phone: string;
  link: string;
};

export function contactNotificationEmail(
  brand: Brand,
  { message: m, body, phone, link }: ContactNotificationData,
): EmailContent {
  const contact = [m.email, phone].filter(Boolean).join(' · ');
  const html = renderLayout({
    brand,
    preheader: `${m.subject}: ${m.preview.slice(0, 90)}`,
    body: [
      `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${brand.color};">${escapeHtml(m.subject)}</p>`,
      heading(`New message from ${m.name}`),
      note(
        `<strong style="color:${INK};">${escapeHtml(m.name)}</strong><br>${escapeHtml(contact)}`,
        { icon: '✉️' },
      ),
      quote(body),
      button('Open in the admin panel', link, brand.color),
      divider(),
      paragraph(
        'Reply to this email to answer them directly, or reply from the admin panel so the team sees it.',
        { muted: true },
      ),
    ].join('\n'),
    footerNote: `Sent from the contact form on ${brand.webUrl}.`,
  });
  const text = [
    `New message from ${m.name} (${contact})`,
    `Subject: ${m.subject}`,
    '',
    body,
    '',
    `Open it: ${link}`,
  ].join('\n');
  return { subject: `New message: ${m.subject} · ${m.name}`, html, text };
}

export type MessageReplyData = {
  name: string;
  subject: string;
  reply: string;
  original: string;
  sentAt: Date;
  from: string;
};

export function messageReplyEmail(
  brand: Brand,
  { name, subject, reply, original, sentAt, from }: MessageReplyData,
): EmailContent {
  const firstName = name.split(' ')[0] || 'there';
  const when = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: brand.timezone,
  }).format(new Date(sentAt));
  const html = renderLayout({
    brand,
    preheader: reply.replace(/\s+/g, ' ').slice(0, 110),
    body: [
      heading(`Hi ${firstName},`),
      `<div style="margin:0 0 20px;font-family:${FONT};font-size:16px;line-height:1.65;color:${INK};">${lines(reply)}</div>`,
      paragraph(`${escapeHtml(from)}<br>${escapeHtml(brand.name)}`, {
        html: true,
      }),
      divider(),
      `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;color:${MUTED};">On ${escapeHtml(when)} you wrote (${escapeHtml(subject)}):</p>`,
      quote(original),
    ].join('\n'),
    footerNote: `You received this email because you contacted ${brand.name}.`,
  });
  const text = [
    `Hi ${firstName},`,
    '',
    reply,
    '',
    from,
    brand.name,
    '',
    `On ${when} you wrote (${subject}):`,
    ...original.split('\n').map((l) => `> ${l}`),
  ].join('\n');
  return { subject: `Re: ${subject} · ${brand.name}`, html, text };
}
