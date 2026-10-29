import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarHeart, Phone } from "lucide-react";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { reservationsEnabled } from "@/lib/reservations-server";
import { RESERVATIONS_ROUTE } from "@/lib/reservation-routes";

export const RESERVATION_CTA_VARIANTS = ["banner", "inline"] as const;

const sectionSchema = z.object({
  id: z.string().catch("reserve"),
  variant: z.enum(RESERVATION_CTA_VARIANTS).catch("banner"),
  enabled: z.boolean().catch(true),
  props: z
    .object({
      eyebrow: z.string().catch("Reservations"),
      title: z.string().catch("Your table is waiting"),
      subtitle: z.string().optional().catch(undefined),
      image: z.string().optional().catch(undefined),
      cta: z
        .object({ label: z.string(), href: z.string() })
        .catch({ label: "Reserve now", href: RESERVATIONS_ROUTE }),
    })
    .catch({
      eyebrow: "Reservations",
      title: "Your table is waiting",
      cta: { label: "Reserve now", href: RESERVATIONS_ROUTE },
    }),
});

function homeSection(): unknown {
  const pages = (
    getConfig() as unknown as {
      pages?: { home?: { sections?: { type?: string }[] } };
    }
  ).pages;
  return pages?.home?.sections?.find((s) => s?.type === "reservationCta") ?? {};
}

type Props = {
  section?: unknown;
};

const src = (path: string) =>
  /^(https?:\/\/|\/|data:)/.test(path) ? path : `/${path}`;
const withParty = (href: string, n: number) =>
  `${href}${href.includes("?") ? "&" : "?"}party=${n}`;

export default function ReservationCta({ section }: Props) {
  const config = sectionSchema.parse(section ?? homeSection());
  if (!config.enabled || !reservationsEnabled()) return null;

  const site = getConfig() as unknown as {
    business: { phone?: string; reservations?: { maxPartySize?: number } };
  };
  const phone = site.business.phone ?? "";
  const tel = phone.replace(/[^+\d]/g, "");
  const max = site.business.reservations?.maxPartySize ?? 10;
  const sizes = [2, 4, 6].filter((n) => n <= max);
  const { eyebrow, title, subtitle, image, cta } = config.props;

  if (config.variant === "inline") {
    return (
      <section
        id={config.id}
        aria-labelledby={`${config.id}-title`}
        className="bg-background px-(--pad) py-12 text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-16"
      >
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 overflow-hidden rounded-[calc(var(--radius)*2.4)] border border-primary/15 bg-primary/6 p-6 sm:flex-row sm:items-center sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-primary/15 blur-3xl"
          />
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-[0_14px_30px_-14px_var(--primary)]">
            <CalendarHeart className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              {eyebrow}
            </p>
            <h2
              id={`${config.id}-title`}
              className="mt-1.5 text-[clamp(1.6rem,3.2vw,2.3rem)] leading-tight font-medium tracking-tight text-balance"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1.5 max-w-xl text-pretty text-foreground/65">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Link
              href={cta.href}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white shadow-[0_12px_30px_-14px_var(--primary)] transition hover:brightness-110"
            >
              {cta.label}{" "}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {tel && (
              <a
                href={`tel:${tel}`}
                className="inline-flex items-center justify-center gap-1.5 text-sm text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
              >
                <Phone className="size-3.5" /> or call {phone}
              </a>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id={config.id}
      aria-labelledby={`${config.id}-title`}
      className="bg-background px-(--pad) py-10 [--pad:clamp(0.75rem,3vw,2.5rem)] sm:py-14"
    >
      <div className="relative isolate mx-auto flex min-h-120 max-w-375 items-end overflow-hidden rounded-[calc(var(--radius)*2.6)] bg-secondary px-6 py-10 text-white sm:px-12 sm:py-14 lg:items-center">
        {image ? (
          <Image
            src={src(image)}
            alt=""
            fill
            sizes="100vw"
            className="-z-20 object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-20 bg-[radial-gradient(110%_90%_at_0%_100%,var(--primary),transparent_60%),radial-gradient(80%_80%_at_100%_0%,var(--accent),transparent_60%)] opacity-80"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,.78),rgba(0,0,0,.35)_60%,rgba(0,0,0,.15)),linear-gradient(0deg,rgba(0,0,0,.45),transparent_50%)]"
        />

        <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase ring-1 ring-white/20 backdrop-blur-md">
              <CalendarHeart className="size-3.5" /> {eyebrow}
            </p>
            <h2
              id={`${config.id}-title`}
              className="mt-5 text-[clamp(2.4rem,6vw,4.75rem)] leading-[0.98] font-medium tracking-[-0.045em] text-balance"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-4 max-w-lg text-lg text-pretty text-white/80">
                {subtitle}
              </p>
            )}
          </div>

          <div className="w-full rounded-3xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-xl sm:w-auto sm:min-w-80 sm:p-6">
            <p className="text-sm font-medium text-white/80">
              How many of you?
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {sizes.map((n) => (
                <Link
                  key={n}
                  href={withParty(cta.href, n)}
                  className="grid h-12 place-items-center rounded-xl bg-white/12 text-lg font-semibold tabular-nums ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:bg-white hover:text-neutral-900"
                  aria-label={`Book for ${n} guests`}
                >
                  {n}
                </Link>
              ))}
              <Link
                href={cta.href}
                className="grid h-12 place-items-center rounded-xl bg-white/12 text-sm font-semibold ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:bg-white hover:text-neutral-900"
                aria-label="Book for another number of guests"
              >
                More
              </Link>
            </div>
            <Link
              href={cta.href}
              className="group mt-4 inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white shadow-[0_14px_34px_-14px_var(--primary)] transition hover:brightness-110"
            >
              {cta.label}{" "}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {tel && (
              <a
                href={`tel:${tel}`}
                className="mt-3 flex items-center justify-center gap-1.5 text-sm text-white/70 underline-offset-4 hover:text-white hover:underline"
              >
                <Phone className="size-3.5" /> {phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
