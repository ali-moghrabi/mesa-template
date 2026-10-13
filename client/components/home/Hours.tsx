import {
  ArrowUpRight,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { getOpeningHours } from "@/lib/opening-hours-server";
import type { OpeningHours } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";
import { LiveStatus, WeekTable, type TimeFormat } from "./HoursLive";

export const HOURS_VARIANTS = ["map", "simple"] as const;
export type HoursVariant = (typeof HOURS_VARIANTS)[number];

const sectionSchema = z.object({
  id: z.string().catch("hours"),
  variant: z.enum(HOURS_VARIANTS).catch("map"),
  enabled: z.boolean().catch(true),
  props: z
    .object({
      eyebrow: z.string().catch("Hours & location"),
      title: z.string().catch("Visit us"),
      subtitle: z.string().optional().catch(undefined),
      showMap: z.boolean().catch(true),
      showOpenNow: z.boolean().catch(true),
    })
    .catch({
      eyebrow: "Hours & location",
      title: "Visit us",
      showMap: true,
      showOpenNow: true,
    }),
});

type Section = z.infer<typeof sectionSchema>;

type Place = {
  name: string;
  lines: string[];
  phone?: string;
  email?: string;
  whatsapp?: string;
  mapEmbed: string | null;
  directions: string;
};

function homeSection(): unknown {
  const pages = (
    getConfig() as unknown as {
      pages?: { home?: { sections?: { type?: string }[] } };
    }
  ).pages;
  return pages?.home?.sections?.find((s) => s?.type === "hoursLocation") ?? {};
}

function placeFromConfig(): Place {
  const config = getConfig() as unknown as {
    brand: { name: string };
    business: {
      address?:
        | {
            street?: string;
            city?: string;
            region?: string;
            postalCode?: string;
            country?: string;
          }
        | string;
      geo?: { lat: number; lng: number };
      mapEmbedUrl?: string;
      phone?: string;
      email?: string;
      whatsapp?: { number?: string };
    };
  };
  const b = config.business;
  const a =
    typeof b.address === "string" ? { street: b.address } : (b.address ?? {});
  const lines = [
    a.street,
    [a.city, a.postalCode, a.country].filter(Boolean).join(", "),
  ].filter((l): l is string => !!l);
  const query = b.geo
    ? `${b.geo.lat},${b.geo.lng}`
    : [config.brand.name, ...lines].join(", ");

  const custom =
    b.mapEmbedUrl &&
    /^https:\/\/www\.google\.com\/maps\/embed\?/.test(b.mapEmbedUrl) &&
    !/placeholder/i.test(b.mapEmbedUrl)
      ? b.mapEmbedUrl
      : null;
  const mapEmbed =
    custom ??
    (lines.length || b.geo
      ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`
      : null);

  return {
    name: config.brand.name,
    lines,
    phone: b.phone,
    email: b.email,
    whatsapp: b.whatsapp?.number?.replace(/\D/g, ""),
    mapEmbed,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`,
  };
}

type Props = {
  section?: unknown;
};

export default async function Hours({ section }: Props) {
  const config = sectionSchema.parse(section ?? homeSection());
  if (!config.enabled) return null;

  const hours = await getOpeningHours();
  const place = placeFromConfig();
  const timeFormat: TimeFormat =
    (getConfig() as unknown as { locale?: { timeFormat?: string } }).locale
      ?.timeFormat === "12h"
      ? "12h"
      : "24h";
  const look = { config, hours, place, timeFormat };

  return config.variant === "map" && config.props.showMap && place.mapEmbed ? (
    <MapLook {...look} />
  ) : (
    <SimpleLook {...look} />
  );
}

type LookProps = {
  config: Section;
  hours: OpeningHours | null;
  place: Place;
  timeFormat: TimeFormat;
};

function Heading({
  config,
  hours,
  timeFormat,
  center,
  className,
}: {
  config: Section;
  hours: OpeningHours | null;
  timeFormat: TimeFormat;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(center && "text-center", className)}>
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
        {config.props.eyebrow}
      </p>
      <h2
        id={`${config.id}-title`}
        className="mt-3 text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] font-medium tracking-[-0.04em] text-balance"
      >
        {config.props.title}
      </h2>
      {config.props.subtitle && (
        <p
          className={cn(
            "mt-4 max-w-xl text-lg text-pretty text-foreground/70",
            center && "mx-auto",
          )}
        >
          {config.props.subtitle}
        </p>
      )}
      {config.props.showOpenNow && hours && (
        <LiveStatus hours={hours} timeFormat={timeFormat} className="mt-5" />
      )}
    </div>
  );
}

function NoHours() {
  return (
    <p className="text-foreground/60">
      Our opening hours are being updated. Call us and we&apos;ll be happy to
      help.
    </p>
  );
}

function ContactActions({
  place,
  className,
}: {
  place: Place;
  className?: string;
}) {
  const actions = [
    place.phone && {
      href: `tel:${place.phone.replace(/[^\d+]/g, "")}`,
      label: place.phone,
      hint: "Call us",
      icon: Phone,
    },
    place.whatsapp && {
      href: `https://wa.me/${place.whatsapp}`,
      label: "WhatsApp",
      hint: "Message us",
      icon: MessageCircle,
      external: true,
    },
    place.email && {
      href: `mailto:${place.email}`,
      label: place.email,
      hint: "Email us",
      icon: Mail,
    },
  ].filter(Boolean) as {
    href: string;
    label: string;
    hint: string;
    icon: typeof Phone;
    external?: boolean;
  }[];
  if (actions.length === 0) return null;

  return (
    <ul className={cn("grid grid-cols-[minmax(0,1fr)] gap-2", className)}>
      {actions.map(({ href, label, hint, icon: Icon, external }) => (
        <li key={href}>
          <a
            href={href}
            {...(external && { target: "_blank", rel: "noreferrer" })}
            className="group flex items-center gap-3 rounded-2xl border border-foreground/10 px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-primary/4"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-foreground/50">{hint}</span>
              <span className="block truncate font-medium">{label}</span>
            </span>
            <ArrowUpRight className="ml-auto size-4 shrink-0 text-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function Address({ place }: { place: Place }) {
  if (place.lines.length === 0) return null;
  return (
    <address className="not-italic">
      <p className="font-semibold">{place.lines[0]}</p>
      {place.lines.slice(1).map((line) => (
        <p key={line} className="text-foreground/65">
          {line}
        </p>
      ))}
    </address>
  );
}

function DirectionsLink({
  place,
  className,
}: {
  place: Place;
  className?: string;
}) {
  return (
    <a
      href={place.directions}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90",
        className,
      )}
    >
      <Navigation className="size-4 transition-transform group-hover:rotate-12" />{" "}
      Get directions
    </a>
  );
}

function MapLook({ config, hours, place, timeFormat }: LookProps) {
  return (
    <section
      id={config.id}
      aria-labelledby={`${config.id}-title`}
      className="px-(--pad) py-20 [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <Heading
          config={config}
          hours={hours}
          timeFormat={timeFormat}
          className="mb-10 sm:mb-12"
        />

        <div className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[calc(var(--radius)*3)] border border-foreground/10 bg-card shadow-[0_30px_80px_-50px_rgb(0_0_0/0.45)] lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
          {/* Info */}
          <div className="order-2 p-6 sm:p-8 lg:order-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground/55 uppercase">
              <Clock className="size-4" /> Opening hours
            </h3>
            <div className="mt-3">
              {hours ? (
                <WeekTable hours={hours} timeFormat={timeFormat} />
              ) : (
                <NoHours />
              )}
            </div>

            <div className="mt-7 border-t border-foreground/10 pt-6">
              <ContactActions place={place} />
            </div>
          </div>

          <div className="relative order-1 min-h-75 bg-muted sm:min-h-95 lg:order-2 lg:min-h-full">
            <iframe
              src={place.mapEmbed!}
              title={`Map: ${place.name}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="absolute inset-0 size-full border-0 grayscale-35 dark:filter-[invert(0.9)_hue-rotate(180deg)_grayscale(0.3)_contrast(0.9)]"
            />
            <div className="absolute inset-x-3 bottom-3 flex flex-col gap-3 rounded-2xl bg-background/90 p-4 shadow-xl ring-1 ring-foreground/10 backdrop-blur-md sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm sm:flex-row sm:items-center sm:p-4">
              <span className="hidden size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground sm:grid">
                <MapPin className="size-5" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <Address place={place} />
              </div>
              <DirectionsLink
                place={place}
                className="h-10 shrink-0 justify-center"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SimpleLook({ config, hours, place, timeFormat }: LookProps) {
  return (
    <section
      id={config.id}
      aria-labelledby={`${config.id}-title`}
      className="px-(--pad) py-20 [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <Heading
          config={config}
          hours={hours}
          timeFormat={timeFormat}
          center
          className="mb-10 sm:mb-14"
        />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[1.25fr_1fr_1fr]">
          <Column icon={<Clock className="size-5" />} title="Opening hours">
            {hours ? (
              <WeekTable hours={hours} timeFormat={timeFormat} />
            ) : (
              <NoHours />
            )}
          </Column>

          <Column icon={<MapPin className="size-5" />} title="Find us">
            <div className="text-lg">
              <Address place={place} />
            </div>
            <DirectionsLink place={place} className="mt-6" />
          </Column>

          <Column icon={<Phone className="size-5" />} title="Get in touch">
            <ContactActions place={place} />
          </Column>
        </div>
      </div>
    </section>
  );
}

function Column({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[calc(var(--radius)*2.5)] border border-foreground/10 bg-card p-6 sm:p-7">
      <h3 className="mb-4 flex items-center gap-3 text-lg font-semibold tracking-tight">
        <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}
