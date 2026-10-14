import {
  ArrowUpRight,
  AtSign,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { getUserSession } from "@/lib/auth/get-user";
import { getOpeningHours } from "@/lib/opening-hours-server";
import { cn } from "@/lib/utils";
import { LiveStatus } from "@/components/home/HoursLive";
import { ContactForm } from "@/components/forms/ContactForm";

export const CONTACT_VARIANTS = ["split", "simple"] as const;

const sectionSchema = z.object({
  id: z.string().catch("contact"),
  variant: z.enum(CONTACT_VARIANTS).catch("split"),
  enabled: z.boolean().catch(true),
  props: z
    .object({
      eyebrow: z.string().catch("Get in touch"),
      title: z.string().catch("Send us a message"),
      subtitle: z.string().optional().catch(undefined),
      subjects: z.array(z.string().min(1).max(80)).max(20).catch([]),
      responseNote: z.string().catch("We usually reply within a day."),
    })
    .catch({
      eyebrow: "Get in touch",
      title: "Send us a message",
      subjects: [],
      responseNote: "We usually reply within a day.",
    }),
});

type Props = { section?: unknown };

type Way = {
  icon: typeof Phone;
  label: string;
  value: string;
  href: string;
  external?: boolean;
};

export default async function Contact({ section }: Props) {
  const config = sectionSchema.parse(section ?? {});
  if (!config.enabled) return null;

  const site = getConfig() as unknown as {
    brand: { name: string };
    features?: { contactForm?: boolean };
    locale?: { timeFormat?: string };
    business: {
      address?: { street?: string; city?: string; country?: string } | string;
      geo?: { lat: number; lng: number };
      phone?: string;
      email?: string;
      whatsapp?: { number?: string };
      socials?: { platform: string; url: string; handle?: string }[];
    };
  };
  const formOn = site.features?.contactForm === true;
  const [user, hours] = await Promise.all([
    formOn ? getUserSession() : null,
    getOpeningHours(),
  ]);
  const timeFormat = site.locale?.timeFormat === "12h" ? "12h" : "24h";

  const b = site.business;
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

  const ways: Way[] = [
    b.phone && {
      icon: Phone,
      label: "Call us",
      value: b.phone,
      href: `tel:${b.phone.replace(/[^+\d]/g, "")}`,
    },
    whatsapp && {
      icon: MessageCircle,
      label: "WhatsApp",
      value: "Chat with us",
      href: `https://wa.me/${whatsapp}`,
      external: true,
    },
    b.email && {
      icon: Mail,
      label: "Email",
      value: b.email,
      href: `mailto:${b.email}`,
    },
    address && {
      icon: MapPin,
      label: "Visit",
      value: address,
      href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`,
      external: true,
    },
  ].filter(Boolean) as Way[];
  const socials = (b.socials ?? []).filter((s) => /^https?:\/\//.test(s.url));

  const { eyebrow, title, subtitle, subjects, responseNote } = config.props;
  const prefill = user
    ? {
        name: [user.firstName, user.lastName].filter(Boolean).join(" "),
        email: user.email ?? "",
        phone: (user as { phone?: string }).phone ?? "",
      }
    : undefined;

  const form = formOn ? (
    <ContactForm
      subjects={subjects}
      prefill={prefill}
      responseNote={responseNote}
    />
  ) : null;

  if (config.variant === "simple" || !formOn) {
    return (
      <section
        id={config.id}
        aria-labelledby={`${config.id}-title`}
        className="bg-background px-(--pad) py-14 text-foreground [--pad:clamp(1rem,4vw,3.5rem)] sm:py-20"
      >
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              {eyebrow}
            </p>
            <h2
              id={`${config.id}-title`}
              className="mt-2 text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance"
            >
              {formOn ? title : "Reach us directly"}
            </h2>
            {subtitle && (
              <p className="mx-auto mt-3 max-w-xl text-lg text-pretty text-foreground/65">
                {subtitle}
              </p>
            )}
          </div>
          <ul
            className={cn(
              "mt-8 grid gap-3",
              ways.length > 2 ? "sm:grid-cols-2" : "sm:grid-cols-1",
            )}
          >
            {ways.map((w) => (
              <li key={w.label}>
                <WayLink way={w} tone="light" />
              </li>
            ))}
          </ul>
          {form && (
            <div className="mt-8 rounded-[calc(var(--radius)*2.2)] border border-foreground/10 bg-card p-5 shadow-[0_30px_80px_-50px_rgba(0,0,0,.45)] sm:p-8">
              {form}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      id={config.id}
      aria-labelledby={`${config.id}-title`}
      className="bg-background px-(--pad) py-14 text-foreground [--pad:clamp(1rem,4vw,3.5rem)] sm:py-20"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
        <aside className="relative isolate flex flex-col overflow-hidden rounded-[calc(var(--radius)*2.4)] bg-[color-mix(in_oklab,var(--secondary)_38%,#0b0b0b)] p-6 text-white sm:p-8">
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-20 -z-10 size-72 rounded-full bg-primary/40 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-28 -left-16 -z-10 size-64 rounded-full bg-accent/25 blur-3xl"
          />
          <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">
            {eyebrow}
          </p>
          <h2
            id={`${config.id}-title`}
            className="mt-3 text-[clamp(2rem,4vw,2.75rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-3 max-w-md text-pretty text-white/75">
              {subtitle}
            </p>
          )}

          <ul className="mt-8 space-y-2.5">
            {ways.map((w) => (
              <li key={w.label}>
                <WayLink way={w} tone="dark" />
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-8">
            {hours && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                <Clock className="size-4" />
                <LiveStatus
                  hours={hours}
                  timeFormat={timeFormat}
                  tone="inverted"
                />
              </div>
            )}
            {socials.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {socials.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-sm font-medium ring-1 ring-white/15 transition hover:bg-white/20",
                      !s.handle && "capitalize",
                    )}
                  >
                    <AtSign className="size-3.5" /> {s.handle ?? s.platform}
                  </a>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="rounded-[calc(var(--radius)*2.4)] border border-foreground/10 bg-card p-5 shadow-[0_30px_80px_-50px_rgba(0,0,0,.45)] sm:p-8 lg:p-10">
          <p className="text-lg font-semibold tracking-tight">Write to us</p>
          <p className="mt-1 mb-6 text-sm text-foreground/55">
            For bookings, use the reservation page. For anything else,
            we&apos;re all ears.
          </p>
          {form}
        </div>
      </div>
    </section>
  );
}

function WayLink({ way: w, tone }: { way: Way; tone: "dark" | "light" }) {
  const Icon = w.icon;
  const external = w.external ? { target: "_blank", rel: "noreferrer" } : {};
  return (
    <a
      href={w.href}
      {...external}
      className={cn(
        "group flex items-center gap-4 rounded-2xl p-3.5 transition",
        tone === "dark"
          ? "bg-white/6 ring-1 ring-white/10 hover:bg-white/12"
          : "border border-foreground/10 bg-card hover:border-foreground/25",
      )}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl",
          tone === "dark" ? "bg-white/12" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-xs font-medium",
            tone === "dark" ? "text-white/60" : "text-foreground/50",
          )}
        >
          {w.label}
        </span>
        <span className="block truncate font-medium">{w.value}</span>
      </span>
      {w.label === "Visit" ? (
        <Navigation
          className={cn(
            "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
            tone === "dark" ? "text-white/60" : "text-foreground/40",
          )}
        />
      ) : (
        <ArrowUpRight
          className={cn(
            "size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
            tone === "dark" ? "text-white/60" : "text-foreground/40",
          )}
        />
      )}
    </a>
  );
}
