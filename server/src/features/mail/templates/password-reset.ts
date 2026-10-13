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

export type PasswordResetData = {
  firstName: string;
  link: string;
  expiresInMinutes: number;
  requestedAt: string;
};

export function passwordResetEmail(
  brand: Brand,
  data: PasswordResetData,
): EmailContent {
  const subject = `Reset your ${brand.name} password`;
  const name = data.firstName.trim() || 'there';

  const body = [
    heading('Reset your password'),
    paragraph(`Hi ${name},`),
    paragraph(
      `Someone (hopefully you) asked to reset the password of your ${brand.name} account. Choose a new one with the button below.`,
    ),
    button('Choose a new password', data.link, brand.color),
    note(
      `This link works for <strong style="color:#1F1B16;">${data.expiresInMinutes} minutes</strong> and only once. Asked at ${escapeHtml(data.requestedAt)}.`,
    ),
    fallbackLink(data.link),
    divider(),
    paragraph(
      `Didn't ask for this? You can ignore this email: your password stays the same and nobody can change it without this link.`,
      { muted: true },
    ),
  ].join('\n');

  const html = renderLayout({
    brand,
    preheader: `Choose a new password. The link works for ${data.expiresInMinutes} minutes.`,
    body,
    footerNote: `You received this email because a password reset was requested for your ${brand.name} account.`,
  });

  const text = [
    `Hi ${name},`,
    '',
    `Someone (hopefully you) asked to reset the password of your ${brand.name} account.`,
    `Choose a new password here (works for ${data.expiresInMinutes} minutes, once):`,
    data.link,
    '',
    `Asked at ${data.requestedAt}.`,
    `Didn't ask for this? Ignore this email: your password stays the same.`,
    '',
    `${brand.name} · ${brand.webUrl}`,
  ].join('\n');

  return { subject, html, text };
}
