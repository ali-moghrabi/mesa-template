import type { Brand } from '../mail.config';

export type EmailContent = { subject: string; html: string; text: string };

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = '#1F1B16';
const MUTED = '#6B6258';
const LINE = '#EDE6DC';
const PAGE = '#F6F2EC';

function shade(hex: string, amount = 0.18) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`;
}

export const heading = (text: string) =>
  `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${INK};">${escapeHtml(text)}</h1>`;

export const paragraph = (text: string, { html = false, muted = false } = {}) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${muted ? MUTED : INK};">${html ? text : escapeHtml(text)}</p>`;

export function button(label: string, href: string, color: string) {
  const url = escapeHtml(href);
  const text = escapeHtml(label);
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr><td align="center" bgcolor="${color}" style="border-radius:999px;background:${color};border:1px solid ${shade(color)};">
    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:50px;v-text-anchor:middle;width:260px;" arcsize="50%" stroke="f" fillcolor="${color}"><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${text}</center></v:roundrect><![endif]-->
    <!--[if !mso]><!-- --><a href="${url}" target="_blank" style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px;">${text}</a><!--<![endif]-->
  </td></tr>
</table>`;
}

export const note = (htmlContent: string, { icon = '⏱' } = {}) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr><td style="background:${PAGE};border-radius:14px;padding:14px 16px;font-family:${FONT};font-size:14px;line-height:1.55;color:${MUTED};">
    <span style="font-size:15px;">${icon}</span>&nbsp; ${htmlContent}
  </td></tr>
</table>`;

export const fallbackLink = (href: string) =>
  `<p style="margin:0 0 4px;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">Button not working? Copy this link into your browser:</p>
<p style="margin:0 0 20px;font-family:${FONT};font-size:13px;line-height:1.5;word-break:break-all;"><a href="${escapeHtml(href)}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(href)}</a></p>`;

export const divider = () =>
  `<div style="height:1px;background:${LINE};margin:8px 0 20px;line-height:1px;font-size:1px;">&nbsp;</div>`;

export function renderLayout({
  brand,
  preheader,
  body,
  footerNote,
}: {
  brand: Brand;
  preheader: string;
  body: string;
  footerNote: string;
}): string {
  const name = escapeHtml(brand.name);
  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${name}" height="36" style="display:block;height:36px;width:auto;border:0;outline:none;">`
    : `<span style="font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">${name}</span>`;

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${name}</title>
<style>
  @media (max-width:620px){ .card{padding:28px 22px !important;} .outer{padding:16px 10px !important;} }
  a{color:${brand.color};}
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
  <tr><td class="outer" align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <!-- brand bar -->
      <tr><td style="background:${brand.color};border-radius:20px 20px 0 0;padding:22px 32px;">
        <a href="${escapeHtml(brand.webUrl)}" target="_blank" style="text-decoration:none;">${logo}</a>
      </td></tr>
      <!-- card -->
      <tr><td class="card" style="background:#ffffff;border-radius:0 0 20px 20px;padding:36px 40px 32px;border:1px solid ${LINE};border-top:0;">
        ${body}
      </td></tr>
      <!-- footer -->
      <tr><td align="center" style="padding:24px 12px 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:#9A9086;">
        ${escapeHtml(footerNote)}<br>
        <a href="${escapeHtml(brand.webUrl)}" target="_blank" style="color:#9A9086;text-decoration:underline;">${name}</a>${brand.address ? ` · ${escapeHtml(brand.address)}` : ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
