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

export type EmailVerificationData = {
  firstName: string;
  email: string;
  link: string;
  expiresInHours: number;
};

export function emailVerificationEmail(
  brand: Brand,
  data: EmailVerificationData,
): EmailContent {
  const subject = `Verify your email for ${brand.name}`;
  const name = data.firstName.trim() || 'there';
  const hours = `${data.expiresInHours} hour${data.expiresInHours === 1 ? '' : 's'}`;

  const body = [
    heading('Confirm it’s you'),
    paragraph(`Hi ${name},`),
    paragraph(
      `Please confirm that <strong style="color:#1F1B16;">${escapeHtml(data.email)}</strong> is your email address. It keeps your ${escapeHtml(brand.name)} account safe and makes sure your booking and order emails reach you.`,
      { html: true },
    ),
    button('Verify my email', data.link, brand.color),
    note(
      `This link works for <strong style="color:#1F1B16;">${hours}</strong>. You can always ask for a new one from your account page.`,
    ),
    fallbackLink(data.link),
    divider(),
    paragraph(
      `Didn't create an account with ${brand.name}? You can ignore this email: nothing happens without a click on the button.`,
      { muted: true },
    ),
  ].join('\n');

  const html = renderLayout({
    brand,
    preheader: `One click to confirm your email address. The link works for ${hours}.`,
    body,
    footerNote: `You received this email because ${data.email} was used for an account at ${brand.name}.`,
  });

  const text = [
    `Hi ${name},`,
    '',
    `Please confirm that ${data.email} is your email address for your ${brand.name} account.`,
    `Verify it here (works for ${hours}):`,
    data.link,
    '',
    `Didn't create an account? Ignore this email: nothing happens without a click.`,
    '',
    `${brand.name} · ${brand.webUrl}`,
  ].join('\n');

  return { subject, html, text };
}
