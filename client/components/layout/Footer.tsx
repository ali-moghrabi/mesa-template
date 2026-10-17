import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import { getConfig } from "@/config/loader";
import { getOpeningHours } from "@/lib/opening-hours-server";
import { groupWeekly } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";
import { CookieSettingsLink } from "@/components/consent/CookieConsent";
import { NewsletterFooterLink } from "@/components/shared/NewsletterFooterLink";
import { LiveStatus, type TimeFormat } from "@/components/home/HoursLive";
import { MesaCredit } from "@/components/onboarding/DemoPromo";

type FooterProps = {
  footer: {
    variant: "columns" | "minimal" | "centered";
    copyright?: string | undefined;
    links?: { label: string; href: string }[] | undefined;
    tagline?: string | undefined;
  };
  newsletter?: boolean;
  cookieSettings?: boolean;
};

type NavLink = { label: string; href: string };
type Social = { platform: string; url: string; handle?: string };

type SiteConfig = {
  brand: {
    name: string;
    tagline?: string;
    description?: string;
    logo?: { light?: string; dark?: string };
  };
  layout?: { navbar?: { links?: NavLink[] } };
  pages?: Record<string, { enabled?: boolean } | undefined>;
  features?: Record<string, boolean | undefined>;
  locale?: { timeFormat?: string };
  business?: {
    address?:
      | {
          street?: string;
          city?: string;
          postalCode?: string;
          country?: string;
        }
      | string;
    geo?: { lat: number; lng: number };
    phone?: string;
    email?: string;
    whatsapp?: { number?: string };
    socials?: Social[];
  };
};

async function footerData(footer: FooterProps["footer"]) {
  const site = getConfig() as unknown as SiteConfig;
  const hours = await getOpeningHours();
  const b = site.business ?? {};
  const timeFormat: TimeFormat =
    site.locale?.timeFormat === "12h" ? "12h" : "24h";

  const address =
    typeof b.address === "string"
      ? b.address
      : [b.address?.street, b.address?.city, b.address?.country]
          .filter(Boolean)
          .join(", ");
  const mapQuery = b.geo
    ? `${b.geo.lat},${b.geo.lng}`
    : `${site.brand.name}, ${address}`;
  const whatsapp = b.whatsapp?.number?.replace(/\D/g, "");

  const reservations = site.pages?.reservations?.enabled === true;
  const pages = (site.layout?.navbar?.links ?? []).filter(
    (l) => l.href !== "/",
  );
  if (reservations && !pages.some((l) => l.href === "/reservations"))
    pages.push({ label: "Reservations", href: "/reservations" });

  const year = new Date().getFullYear();
  const copyright = (
    footer.copyright?.trim() || `© {year} ${site.brand.name}`
  ).replace(/\{year\}/g, String(year));

  return {
    name: site.brand.name,
    logo: site.brand.logo,
    tagline: footer.tagline ?? site.brand.description ?? site.brand.tagline,
    contact: {
      address,
      directions:
        address || b.geo
          ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`
          : null,
      phone: b.phone
        ? { label: b.phone, href: `tel:${b.phone.replace(/[^+\d]/g, "")}` }
        : null,
      whatsapp: whatsapp ? `https://wa.me/${whatsapp}` : null,
      email: b.email ?? null,
    },
    socials: (b.socials ?? []).filter((s) =>
      /^https?:\/\/[^/]+\.[a-z]{2,}\/[^.]+/i.test(s.url),
    ),
    hours,
    weekly: hours ? groupWeekly(hours.weekly) : [],
    timeFormat,
    pages,
    reservations,
    legal: footer.links ?? [],
    copyright,
  };
}

type Data = Awaited<ReturnType<typeof footerData>>;

export async function Footer({
  footer,
  newsletter = false,
  cookieSettings = false,
}: FooterProps) {
  const data = await footerData(footer);
  const bottom = (
    <BottomArea
      data={data}
      newsletter={newsletter}
      cookieSettings={cookieSettings}
      centered={footer.variant === "centered"}
    />
  );

  if (footer.variant === "minimal")
    return <MinimalFooter data={data} bottom={bottom} />;
  if (footer.variant === "centered")
    return <CenteredFooter data={data} bottom={bottom} />;
  return <ColumnsFooter data={data} bottom={bottom} />;
}

function ColumnsFooter({ data, bottom }: { data: Data; bottom: ReactNode }) {
  const c = data.contact;
  const hasVisit = c.address || c.phone || c.email || c.whatsapp;

  return (
    <footer className="relative isolate overflow-hidden border-t border-border bg-foreground/2.5 [--pad:clamp(1.25rem,4vw,3.5rem)]">
      <div className="mx-auto max-w-7xl px-(--pad) pt-16 sm:pt-20">
        {data.reservations && (
          <div className="mb-14 flex flex-col gap-6 border-b border-border pb-12 sm:mb-16 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.05] font-medium tracking-[-0.035em] text-balance">
                A table is waiting for you.
              </p>
              {data.hours && (
                <LiveStatus
                  hours={data.hours}
                  timeFormat={data.timeFormat}
                  className="mt-5"
                />
              )}
            </div>
            <Link
              href="/reservations"
              className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-primary px-6 font-semibold text-white shadow-[0_14px_30px_-16px_var(--primary)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:self-auto"
            >
              <CalendarDays className="size-4.5" /> Book a table
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}

        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_0.8fr] lg:gap-10">
          {/* brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Brand data={data} className="text-2xl" />
            {data.tagline && (
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-pretty text-foreground/60">
                {data.tagline}
              </p>
            )}
            {!data.reservations && data.hours && (
              <LiveStatus
                hours={data.hours}
                timeFormat={data.timeFormat}
                className="mt-5"
              />
            )}
            <Socials socials={data.socials} className="mt-6" />
          </div>

          {/* visit */}
          {hasVisit && (
            <Column title="Visit us">
              <address className="space-y-3.5 not-italic">
                {c.address && (
                  <ContactLine icon={MapPin} href={c.directions} external>
                    {c.address}
                  </ContactLine>
                )}
                {c.phone && (
                  <ContactLine icon={Phone} href={c.phone.href}>
                    <span className="tabular-nums">{c.phone.label}</span>
                  </ContactLine>
                )}
                {c.whatsapp && (
                  <ContactLine icon={MessageCircle} href={c.whatsapp} external>
                    WhatsApp us
                  </ContactLine>
                )}
                {c.email && (
                  <ContactLine icon={Mail} href={`mailto:${c.email}`}>
                    <span className="break-all">{c.email}</span>
                  </ContactLine>
                )}
              </address>
            </Column>
          )}

          {/* hours */}
          {data.weekly.length > 0 && (
            <Column title="Opening hours">
              <dl className="space-y-2.5 text-sm">
                {data.weekly.map((row) => (
                  <div
                    key={row.days}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="text-foreground/60">{row.days}</dt>
                    <dd
                      className={cn(
                        "text-right tabular-nums",
                        row.closed ? "text-foreground/40" : "font-medium",
                      )}
                    >
                      {row.closed
                        ? "Closed"
                        : timesIn(row.hours, data.timeFormat)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Column>
          )}

          {/* explore */}
          {data.pages.length > 0 && (
            <Column title="Explore">
              <nav
                aria-label="Footer"
                className="flex flex-col items-start gap-3"
              >
                {data.pages.map((page) => (
                  <Link key={page.href} href={page.href} className={PAGE_LINK}>
                    {page.label}
                  </Link>
                ))}
              </nav>
            </Column>
          )}
        </div>

        <div className="mt-16 border-t border-border">{bottom}</div>
      </div>

      <p
        aria-hidden="true"
        style={{
          fontSize: `min(17rem, ${(92 / (Math.max(data.name.length, 4) * 0.6)).toFixed(2)}vw)`,
        }}
        className="pointer-events-none mb-[-0.2em] overflow-hidden px-(--pad) text-center leading-[0.85] font-semibold tracking-[-0.06em] whitespace-nowrap text-foreground/4.5 select-none"
      >
        {data.name}
      </p>
    </footer>
  );
}

function MinimalFooter({ data, bottom }: { data: Data; bottom: ReactNode }) {
  return (
    <footer className="border-t border-border [--pad:clamp(1.25rem,4vw,3.5rem)]">
      <div className="mx-auto max-w-7xl px-(--pad)">
        <div className="flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Brand data={data} className="text-lg" />
            {data.hours && (
              <LiveStatus
                hours={data.hours}
                timeFormat={data.timeFormat}
                className="min-h-8 px-3 py-1 text-[13px]"
              />
            )}
          </div>
          {data.pages.length > 0 && (
            <nav
              aria-label="Footer"
              className="flex flex-wrap gap-x-6 gap-y-2.5"
            >
              {data.pages.map((page) => (
                <Link key={page.href} href={page.href} className={PAGE_LINK}>
                  {page.label}
                </Link>
              ))}
            </nav>
          )}
          <Socials socials={data.socials} />
        </div>
        <div className="border-t border-border">{bottom}</div>
      </div>
    </footer>
  );
}

function CenteredFooter({ data, bottom }: { data: Data; bottom: ReactNode }) {
  const c = data.contact;
  return (
    <footer className="relative isolate overflow-hidden border-t border-border [--pad:clamp(1.25rem,4vw,3.5rem)]">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_70%)]"
      />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-(--pad) pt-16 text-center sm:pt-20">
        <Brand data={data} className="text-3xl" />
        {data.tagline && (
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-pretty text-foreground/60">
            {data.tagline}
          </p>
        )}
        {data.hours && (
          <LiveStatus
            hours={data.hours}
            timeFormat={data.timeFormat}
            className="mt-6"
          />
        )}

        {data.pages.length > 0 && (
          <nav
            aria-label="Footer"
            className="mt-9 flex flex-wrap justify-center gap-x-7 gap-y-3"
          >
            {data.pages.map((page) => (
              <Link key={page.href} href={page.href} className={PAGE_LINK}>
                {page.label}
              </Link>
            ))}
          </nav>
        )}

        {(c.address || c.phone || c.email) && (
          <address className="mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-foreground/60 not-italic">
            {c.address && (
              <InlineContact icon={MapPin} href={c.directions} external>
                {c.address}
              </InlineContact>
            )}
            {c.phone && (
              <InlineContact icon={Phone} href={c.phone.href}>
                <span className="tabular-nums">{c.phone.label}</span>
              </InlineContact>
            )}
            {c.email && (
              <InlineContact icon={Mail} href={`mailto:${c.email}`}>
                {c.email}
              </InlineContact>
            )}
          </address>
        )}

        <Socials socials={data.socials} className="mt-8 justify-center" />
      </div>
      <div className="mx-auto mt-14 max-w-7xl px-(--pad)">
        <div className="border-t border-border">{bottom}</div>
      </div>
    </footer>
  );
}

const PAGE_LINK =
  "rounded-sm text-[15px] text-foreground/70 underline-offset-[5px] transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const SMALL_LINK =
  "rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const timesIn = (hours: string, format: TimeFormat) =>
  format === "24h"
    ? hours
    : hours.replace(
        /\b([01]\d|2[0-3]):([0-5]\d)\b/g,
        (_t, h: string, m: string) => {
          const hour = Number(h);
          const twelve = hour % 12 === 0 ? 12 : hour % 12;
          return `${twelve}${m === "00" ? "" : `:${m}`} ${hour < 12 ? "AM" : "PM"}`;
        },
      );

function Brand({ data, className }: { data: Data; className?: string }) {
  const light = data.logo?.light && `/${data.logo.light.replace(/^\/+/, "")}`;
  const dark = data.logo?.dark && `/${data.logo.dark.replace(/^\/+/, "")}`;
  return (
    <Link
      href="/"
      aria-label={`${data.name}, home`}
      className={cn(
        "inline-flex items-center rounded-md font-semibold tracking-[-0.04em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
        className,
      )}
    >
      {light || dark ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG logos, no resizing needed */}
          <img
            src={light || dark}
            alt=""
            className={cn("h-9 w-auto", dark && "dark:hidden")}
          />
          {dark && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dark} alt="" className="hidden h-9 w-auto dark:block" />
          )}
        </>
      ) : (
        data.name
      )}
    </Link>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-5 text-xs font-semibold tracking-[0.16em] text-foreground/45 uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

function ContactLine({
  icon: Icon,
  href,
  external,
  children,
}: {
  icon: typeof Phone;
  href: string | null;
  external?: boolean;
  children: ReactNode;
}) {
  const body = (
    <>
      <Icon className="mt-0.5 size-4 shrink-0 text-foreground/45 transition-colors group-hover:text-primary" />
      <span className="min-w-0">{children}</span>
      {external && (
        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-foreground/35 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </>
  );
  const cls =
    "group flex items-start gap-3 text-[15px] leading-snug text-foreground/75";
  if (!href) return <p className={cls}>{body}</p>;
  return (
    <a
      href={href}
      {...(external && { target: "_blank", rel: "noopener noreferrer" })}
      className={cn(
        cls,
        "rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      )}
    >
      {body}
    </a>
  );
}

function InlineContact({
  icon: Icon,
  href,
  external,
  children,
}: {
  icon: typeof Phone;
  href: string | null;
  external?: boolean;
  children: ReactNode;
}) {
  const body = (
    <>
      <Icon className="size-3.5 shrink-0 text-foreground/40" /> {children}
    </>
  );
  if (!href)
    return <span className="inline-flex items-center gap-1.5">{body}</span>;
  return (
    <a
      href={href}
      {...(external && { target: "_blank", rel: "noopener noreferrer" })}
      className={cn("inline-flex items-center gap-1.5", SMALL_LINK)}
    >
      {body}
    </a>
  );
}

function BottomBar({
  data,
  newsletter,
  cookieSettings,
  centered,
}: {
  data: Data;
  newsletter: boolean;
  cookieSettings: boolean;
  centered?: boolean;
}) {
  const hasLinks = data.legal.length > 0 || newsletter || cookieSettings;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 py-6 text-[13px] text-foreground/50 sm:flex-row sm:items-center sm:justify-between",
        centered && "items-center text-center",
      )}
    >
      <p>{data.copyright}</p>
      {hasLinks && (
        <nav
          aria-label="Legal"
          className={cn(
            "flex flex-wrap gap-x-5 gap-y-2",
            centered && "justify-center",
          )}
        >
          {data.legal.map((link) => (
            <Link key={link.href} href={link.href} className={SMALL_LINK}>
              {link.label}
            </Link>
          ))}
          {cookieSettings && <CookieSettingsLink className={SMALL_LINK} />}
          {newsletter && <NewsletterFooterLink className={SMALL_LINK} />}
        </nav>
      )}
    </div>
  );
}

/** The bottom bar, plus "Built with MESA" on the demo site only (ONBOARDING_ENABLED) */
function BottomArea(props: {
  data: Data;
  newsletter: boolean;
  cookieSettings: boolean;
  centered?: boolean;
}) {
  return (
    <>
      <BottomBar {...props} />
      <MesaCredit centered={props.centered} />
    </>
  );
}

/* ───────────── social links ───────────── */

function Socials({
  socials,
  className,
}: {
  socials: Social[];
  className?: string;
}) {
  if (socials.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {socials.map((s) => {
        const name = SOCIAL_NAMES[s.platform.toLowerCase()] ?? s.platform;
        return (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name}${s.handle ? ` (${s.handle})` : ""}`}
              title={name}
              className="grid size-10 place-items-center rounded-full border border-foreground/12 text-foreground/65 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <SocialIcon platform={s.platform.toLowerCase()} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

const SOCIAL_NAMES: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  twitter: "X",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tripadvisor: "Tripadvisor",
  google: "Google",
};

/** Simple line icons, drawn here: icon libraries no longer ship brand logos */
function SocialIcon({ platform }: { platform: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (platform) {
    case "instagram":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 3c.4 2.6 2.2 4.4 5 4.6" />
        </svg>
      );
    case "x":
    case "twitter":
      return (
        <svg {...common}>
          <path d="M4 4l16 16M20 4L4 20" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <rect x="2.5" y="5" width="19" height="14" rx="4" />
          <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 10.5V16M8 7.5v.01M12 16v-3.2a2.3 2.3 0 0 1 4.6 0V16M12 10.5V16" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
  }
}
