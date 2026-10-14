/**
 * Cookie consent: what the visitor allowed, kept in one first-party cookie.
 *
 *   necessary  always on (sign-in, cart, this choice). The law doesn't require asking for these.
 *   analytics  Google Analytics / Tag Manager: how people use the site
 *   marketing  Meta Pixel: measuring ads
 *
 * The choice is stored for 6 months in "mesa_consent", then the banner asks again. Bump
 * CONSENT_VERSION when the list of tools changes, to ask everyone again.
 * Client-only helpers (they read document.cookie); safe to import anywhere.
 */

export const CONSENT_COOKIE = "mesa_consent";
export const CONSENT_VERSION = 1;
const MAX_AGE = 60 * 60 * 24 * 182; // about 6 months
const CHANGE_EVENT = "mesa:consent-change";
const OPEN_EVENT = "mesa:consent-open";

export type ConsentCategory = "analytics" | "marketing";
export type Consent = {
  v: number;
  analytics: boolean;
  marketing: boolean;
  at: number;
};

/** document.cookie, or "" where the browser blocks it (sandboxed frames, some privacy modes) */
function allCookies(): string {
  try {
    return typeof document === "undefined" ? "" : document.cookie;
  } catch {
    return "";
  }
}

/** The visitor's choice, or null when they haven't chosen yet (or it's from an older version) */
export function readConsent(): Consent | null {
  const raw = allCookies()
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!raw) return null;
  try {
    const value = JSON.parse(
      decodeURIComponent(raw.slice(CONSENT_COOKIE.length + 1)),
    ) as Partial<Consent>;
    if (value.v !== CONSENT_VERSION) return null;
    return {
      v: CONSENT_VERSION,
      analytics: value.analytics === true,
      marketing: value.marketing === true,
      at: Number(value.at) || 0,
    };
  } catch {
    return null;
  }
}

/** Saves the choice. Turning something off also removes the cookies those tools left behind. */
export function saveConsent(choice: {
  analytics: boolean;
  marketing: boolean;
}) {
  const before = readConsent();
  const value: Consent = {
    v: CONSENT_VERSION,
    analytics: choice.analytics,
    marketing: choice.marketing,
    at: Date.now(),
  };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  try {
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
  } catch {
    return; // cookies blocked: nothing can be remembered, nothing optional loads
  }

  if (!choice.analytics) removeCookies([/^_ga($|_)/, /^_gid$/, /^_gat/]);
  if (!choice.marketing) removeCookies([/^_fbp$/, /^_fbc$/]);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));

  // Scripts already running can't be unloaded: a fresh page makes a withdrawal take effect at once
  const withdrawn =
    (before?.analytics && !choice.analytics) ||
    (before?.marketing && !choice.marketing);
  if (withdrawn) window.location.reload();
}

/** Deletes cookies by name, on this host and its parent domains (where analytics tools set them) */
function removeCookies(patterns: RegExp[]) {
  const names = allCookies()
    .split("; ")
    .map((c) => c.split("=")[0]);
  const host = location.hostname;
  const parts = host.split(".");
  const domains = [
    "",
    ...parts
      .map((_, i) => parts.slice(i).join("."))
      .filter((d) => d.includes("."))
      .map((d) => `; Domain=.${d}`),
  ];
  for (const name of names) {
    if (!patterns.some((p) => p.test(name))) continue;
    for (const domain of domains)
      document.cookie = `${name}=; Path=/; Max-Age=0${domain}`;
  }
}

/* ───────────── for React (useSyncExternalStore) ───────────── */

let snapshot: { raw: string; value: Consent | null } = {
  raw: "\0",
  value: null,
};

/** The same object until the cookie changes, so React doesn't re-render for nothing */
export function consentSnapshot(): Consent | null {
  const raw =
    allCookies()
      .split("; ")
      .find((c) => c.startsWith(`${CONSENT_COOKIE}=`)) ?? "";
  if (raw !== snapshot.raw) snapshot = { raw, value: readConsent() };
  return snapshot.value;
}

export function subscribeConsent(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Opens the cookie preferences (the footer's "Cookie settings" link) */
export const openCookieSettings = () =>
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));

export function onOpenCookieSettings(handler: () => void) {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}
