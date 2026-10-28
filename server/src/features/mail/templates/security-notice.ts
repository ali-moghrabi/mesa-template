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

export type PasswordNoticeData = {
  firstName: string;
  kind: 'added' | 'changed';
  at: string;
  resetLink: string;
};

export function passwordNoticeEmail(
  brand: Brand,
  data: PasswordNoticeData,
): EmailContent {
  const added = data.kind === 'added';
  const subject = added
    ? `A password was added to your ${brand.name} account`
    : `Your ${brand.name} password was changed`;
  const name = data.firstName.trim() || 'there';
  const what = added
    ? `A password was added to your ${brand.name} account, so it can now also sign in with your email and that password, not only with Google.`
    : `The password of your ${brand.name} account was just changed. Every other device was signed out.`;

  const body = [
    heading(added ? 'A password was added' : 'Your password was changed'),
    paragraph(`Hi ${name},`),
    paragraph(what),
    note(`Done on ${escapeHtml(data.at)}.`, { icon: '🔐' }),
    paragraph(`Was this you? Then there's nothing to do.`),
    divider(),
    paragraph(
      `Wasn't you? Someone may be using your account. Choose a new password now, then sign out of every device from your account page.`,
    ),
    button('Choose a new password', data.resetLink, brand.color),
  ].join('\n');

  const html = renderLayout({
    brand,
    preheader: added
      ? 'Your account can now sign in with a password.'
      : 'If this was you, there is nothing to do.',
    body,
    footerNote: `You received this security notice because the password of your ${brand.name} account changed.`,
  });

  const text = [
    `Hi ${name},`,
    '',
    what,
    `Done on ${data.at}.`,
    '',
    `Was this you? Then there's nothing to do.`,
    `Wasn't you? Choose a new password now: ${data.resetLink}`,
    '',
    `${brand.name} · ${brand.webUrl}`,
  ].join('\n');

  return { subject, html, text };
}
