import type { OrderView } from 'src/features/orders/orders.service';
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

export type OrderConfirmationData = {
  order: OrderView;
  link: string;
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = '#1F1B16';
const MUTED = '#6B6258';
const LINE = '#EDE6DC';

export function orderConfirmationEmail(
  brand: Brand,
  { order, link }: OrderConfirmationData,
): EmailContent {
  const money = (amount: number) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: order.currency,
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${order.currency}`;
    }
  };
  const time = (iso: string, withDay = false) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: order.schedule.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      ...(withDay && { weekday: 'short', day: 'numeric', month: 'short' }),
    }).format(new Date(iso));

  const delivery = order.type === 'delivery';
  const firstName = order.customer.name.split(' ')[0] || 'there';
  const when = order.schedule.asap
    ? `${delivery ? 'Arriving' : 'Ready'} around ${time(order.schedule.from)}–${time(order.schedule.to)}`
    : `${delivery ? 'Delivered' : 'Ready for pickup'} ${time(order.schedule.from, true)}`;
  const paid =
    order.payment.method === 'online'
      ? 'Paid online'
      : delivery
        ? `Cash on delivery${order.payment.cashChangeFor ? `, change for ${money(order.payment.cashChangeFor)}` : ''}`
        : 'Pay when you pick it up';

  const where =
    delivery && order.address
      ? [
          order.address.street,
          order.address.building && `Building ${order.address.building}`,
          order.address.floor && `Floor ${order.address.floor}`,
          order.address.apartment && `Apt ${order.address.apartment}`,
          order.address.area,
        ]
          .filter(Boolean)
          .join(', ')
      : (order.pickupAddress ?? '');

  /* the items */
  const rows = order.lines
    .map((l) => {
      const details = [
        l.variantName,
        ...l.options.map((o) => o.split(': ').pop()),
        l.note && `“${l.note}”`,
      ]
        .filter(Boolean)
        .join(' · ');
      return `<tr>
  <td style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:15px;line-height:1.45;color:${INK};vertical-align:top;">
    <strong>${l.quantity}×</strong>&nbsp; ${escapeHtml(l.name)}
    ${details ? `<div style="margin-top:2px;font-size:13px;color:${MUTED};">${escapeHtml(details)}</div>` : ''}
  </td>
  <td align="right" style="padding:12px 0 12px 12px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:15px;color:${INK};white-space:nowrap;vertical-align:top;">${money(l.total)}</td>
</tr>`;
    })
    .join('');

  const a = order.amounts;
  const totalRow = (
    label: string,
    value: string,
    { strong = false, green = false } = {},
  ) =>
    `<tr><td style="padding:4px 0;font-family:${FONT};font-size:${strong ? 17 : 14}px;color:${green ? '#15803D' : strong ? INK : MUTED};font-weight:${strong ? 700 : 400};">${escapeHtml(label)}</td><td align="right" style="padding:4px 0;font-family:${FONT};font-size:${strong ? 17 : 14}px;color:${green ? '#15803D' : INK};font-weight:${strong ? 700 : 500};white-space:nowrap;">${value}</td></tr>`;
  const vatLabel = `VAT ${Math.round(a.vatRate * 100)}%${a.vatIncluded ? ' (included)' : ''}`;
  const totals = [
    totalRow('Subtotal', money(a.subtotal)),
    a.savings > 0
      ? totalRow('You saved', `−${money(a.savings)}`, { green: true })
      : '',
    delivery
      ? totalRow('Delivery', a.deliveryFee > 0 ? money(a.deliveryFee) : 'Free')
      : '',
    a.tip > 0 ? totalRow('Tip', money(a.tip)) : '',
    a.vat > 0 ? totalRow(vatLabel, money(a.vat)) : '',
    totalRow('Total', money(a.total), { strong: true }),
  ].join('');

  const body = [
    `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${brand.color};">Order #${escapeHtml(order.number)}</p>`,
    heading(order.schedule.asap ? 'Your order is in!' : "You're all set!"),
    paragraph(
      `Thanks ${firstName}, we've got your order and the kitchen is on it. Here's everything in one place.`,
    ),
    note(
      `<strong style="color:${INK};">${escapeHtml(when)}</strong><br>${escapeHtml(delivery ? 'Delivery to' : 'Pickup at')} ${escapeHtml(where)}`,
      { icon: delivery ? '🛵' : '🛍' },
    ),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">${rows}</table>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${totals}</table>`,
    paragraph(paid, { muted: true }),
    button('Track your order', link, brand.color),
    divider(),
    paragraph(
      `Something wrong with your order? Reply to this email or call us and mention #${order.number}.`,
      { muted: true },
    ),
  ].join('\n');

  const html = renderLayout({
    brand,
    preheader: `${when}. Total ${money(a.total)}.`,
    body,
    footerNote: `You received this email because you placed order #${order.number} at ${brand.name}.`,
  });

  const text = [
    `Order #${order.number}`,
    '',
    `Thanks ${firstName}, we've got your order.`,
    when,
    `${delivery ? 'Delivery to' : 'Pickup at'}: ${where}`,
    '',
    ...order.lines.map(
      (l) =>
        `${l.quantity}× ${l.name}${l.variantName ? ` (${l.variantName})` : ''}  ${money(l.total)}`,
    ),
    '',
    `Subtotal ${money(a.subtotal)}`,
    ...(a.savings > 0 ? [`You saved −${money(a.savings)}`] : []),
    ...(delivery
      ? [`Delivery ${a.deliveryFee > 0 ? money(a.deliveryFee) : 'Free'}`]
      : []),
    ...(a.tip > 0 ? [`Tip ${money(a.tip)}`] : []),
    ...(a.vat > 0 ? [`${vatLabel} ${money(a.vat)}`] : []),
    `Total ${money(a.total)}`,
    paid,
    '',
    `Track your order: ${link}`,
    '',
    `${brand.name} · ${brand.webUrl}`,
  ].join('\n');

  return {
    subject: `Order #${order.number} confirmed · ${brand.name}`,
    html,
    text,
  };
}
