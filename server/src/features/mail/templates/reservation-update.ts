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

export type ReservationUpdateKind =
  'confirmed' | 'declined' | 'cancelled' | 'changed';

export type ReservationUpdateData = {
  reservation: ReservationView;
  kind: ReservationUpdateKind;
  reason?: string;
  link: string;
  hasAccount: boolean;
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = '#1F1B16';

const COPY: Record<
  ReservationUpdateKind,
  { subject: string; title: string; lead: string; icon: string }
> = {
  confirmed: {
    subject: 'Your table is confirmed',
    title: 'See you soon!',
    lead: 'Your table is confirmed. We look forward to welcoming you.',
    icon: '✅',
  },
  declined: {
    subject: "We couldn't confirm your table",
    title: "We're sorry",
    lead: "Unfortunately we can't take your booking for this time.",
    icon: '🙏',
  },
  cancelled: {
    subject: 'Your booking was cancelled',
    title: 'Booking cancelled',
    lead: 'Your booking has been cancelled.',
    icon: '📅',
  },
  changed: {
    subject: 'Your booking was updated',
    title: 'Your booking changed',
    lead: 'We updated your booking. Here are the new details.',
    icon: '✏️',
  },
};

export function reservationUpdateEmail(
  brand: Brand,
  { reservation: r, kind, reason, link, hasAccount }: ReservationUpdateData,
): EmailContent {
  const copy = COPY[kind];
  const when = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${r.date}T12:00:00Z`));
  const guests = `${r.partySize} ${r.partySize === 1 ? 'guest' : 'guests'}`;
  const firstName = r.name.split(' ')[0] || 'there';
  const closing = kind === 'declined' || kind === 'cancelled';

  const body = [
    `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${brand.color};">Booking #${escapeHtml(r.number)}</p>`,
    heading(copy.title),
    paragraph(
      `Hi ${firstName}, ${copy.lead.charAt(0).toLowerCase()}${copy.lead.slice(1)}`,
    ),
    note(
      `<strong style="color:${INK};">${escapeHtml(when)} at ${escapeHtml(r.time)}</strong><br>${escapeHtml(guests)}${brand.address ? ` · ${escapeHtml(brand.address)}` : ''}`,
      { icon: copy.icon },
    ),
    ...(reason
      ? [paragraph(`A note from us: “${reason}”`, { muted: true })]
      : []),
    ...(closing
      ? [
          paragraph(
            'We hope to welcome you another time. You can book a new table on our website whenever you like.',
            { muted: true },
          ),
        ]
      : []),
    ...(hasAccount
      ? [
          button(
            closing ? 'Book another table' : 'See your booking',
            closing ? `${brand.webUrl}/reservations` : link,
            brand.color,
          ),
        ]
      : []),
    divider(),
    paragraph(
      `Questions? Reply to this email or call us and mention #${r.number}.`,
      { muted: true },
    ),
  ].join('\n');

  const html = renderLayout({
    brand,
    preheader: `${when} at ${r.time} · ${guests}`,
    body,
    footerNote: `You received this email about your booking at ${brand.name}.`,
  });

  const text = [
    `Booking #${r.number}`,
    '',
    `Hi ${firstName}, ${copy.lead}`,
    '',
    `${when} at ${r.time}`,
    guests,
    ...(reason ? ['', `A note from us: “${reason}”`] : []),
    '',
    ...(hasAccount
      ? [
          `${closing ? 'Book another table' : 'See your booking'}: ${closing ? `${brand.webUrl}/reservations` : link}`,
          '',
        ]
      : []),
    `${brand.name} · ${brand.webUrl}`,
  ].join('\n');

  return { subject: `${copy.subject} · ${brand.name}`, html, text };
}
