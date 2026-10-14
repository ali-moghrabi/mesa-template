import type { ReservationView } from 'src/features/reservations/reservations.service';
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

export type ReservationRequestData = {
  reservation: ReservationView;
  link: string;
  message: string;
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = '#1F1B16';

export function reservationRequestEmail(
  brand: Brand,
  { reservation: r, link, message }: ReservationRequestData,
): EmailContent {
  const when = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${r.date}T12:00:00Z`));
  const guests = `${r.partySize} ${r.partySize === 1 ? 'guest' : 'guests'}`;
  const firstName = r.name.split(' ')[0] || 'there';
  const details = [
    r.occasion && `Occasion: ${r.occasion}`,
    r.notes && `Your note: “${r.notes}”`,
  ].filter(Boolean) as string[];

  const body = [
    `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${brand.color};">Booking #${escapeHtml(r.number)}</p>`,
    heading('We got your request'),
    paragraph(`Thanks ${firstName}! ${message}`),
    note(
      `<strong style="color:${INK};">${escapeHtml(when)} at ${escapeHtml(r.time)}</strong><br>${escapeHtml(guests)}${brand.address ? ` · ${escapeHtml(brand.address)}` : ''}`,
      { icon: '🍽' },
    ),
    ...details.map((d) => paragraph(d, { muted: true })),
    button('See your booking', link, brand.color),
    divider(),
    paragraph(
      `Plans changed? Cancel from your account, or reply to this email and mention #${r.number}.`,
      { muted: true },
    ),
  ].join('\n');

  const html = renderLayout({
    brand,
    preheader: `${when} at ${r.time} · ${guests}. We'll confirm shortly.`,
    body,
    footerNote: `You received this email because you asked for a table at ${brand.name}.`,
  });

  const text = [
    `Booking #${r.number}`,
    '',
    `Thanks ${firstName}! ${message}`,
    '',
    `${when} at ${r.time}`,
    guests,
    ...details,
    '',
    `See your booking: ${link}`,
    '',
    `${brand.name} · ${brand.webUrl}`,
  ].join('\n');

  return { subject: `Booking request received · ${brand.name}`, html, text };
}
