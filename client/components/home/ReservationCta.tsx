import Image from "next/image";
import Link from "next/link";
import { Phone } from "lucide-react";
import type { Section as SectionConfig } from "@/config/schema";
import { getConfig } from "@/config/loader";
import { Section } from "@/components/common/Section";
import { OpenStatus } from "@/components/common/OpenStatus";
import { getOpeningHours } from "@/lib/opening-hours-server";
import { cn } from "@/lib/utils";
import { DisplayTitle, displayFonts } from "./display-title";
import { reservationCtaSchema, type ReservationCtaProps } from "./schema";
import "./reservation.css";

type Props = {
  section: SectionConfig;
};

type Extras = {
  sizes: number[];
  max: number;
  phone: string;
  hours: Awaited<ReturnType<typeof getOpeningHours>>;
};

const withParty = (href: string, n: number) =>
  `${href}${href.includes("?") ? "&" : "?"}party=${n}`;

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export async function ReservationCta({ section }: Props) {
  const props = reservationCtaSchema.parse(section.props);
  const { business } = getConfig();
  const hours = await getOpeningHours();
  const max = business.reservations?.maxPartySize ?? 10;
  const extras: Extras = {
    sizes: [2, 4, 6].filter((n) => n <= max),
    max,
    phone: business.phone ?? "",
    hours,
  };

  return section.variant === "inline" ? (
    <Inline id={section.id} props={props} extras={extras} />
  ) : (
    <Banner id={section.id} props={props} extras={extras} />
  );
}

function Banner({
  id,
  props,
  extras,
}: {
  id: string;
  props: ReservationCtaProps;
  extras: Extras;
}) {
  return (
    <Section id={id} className={displayFonts}>
      <div className="group/cta relative isolate overflow-hidden rounded-[calc(var(--radius)*3)] bg-neutral-950 text-white">
        <Image
          src={`/${props.image}`}
          alt=""
          fill
          sizes="(min-width: 1280px) 1200px, 100vw"
          className="-z-10 object-cover transition-transform duration-1800 ease-out group-hover/cta:scale-[1.04] motion-reduce:transition-none"
          style={{ objectPosition: props.imagePosition }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ backgroundColor: `rgba(0,0,0,${props.overlay})` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(110%_90%_at_0%_100%,rgba(0,0,0,.72)_0%,rgba(0,0,0,.25)_50%,transparent_78%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,.5),transparent_45%)] lg:hidden"
        />
        <div
          aria-hidden="true"
          className="bg-grain pointer-events-none absolute inset-0 -z-10 opacity-[0.07] mix-blend-overlay"
        />

        <div className="grid min-h-120 grid-cols-[minmax(0,1fr)] content-end gap-8 p-5 sm:p-10 lg:min-h-144 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-end lg:gap-14 lg:p-14">
          <div className="min-w-0 pb-1">
            <DisplayTitle
              id={`${id}-title`}
              title={props.title}
              className="max-w-[13ch] text-[clamp(2.6rem,6.2vw,5.75rem)]"
            />
            {props.subtitle && (
              <p className="mt-5 max-w-[42ch] text-[clamp(1rem,1.6vw,1.15rem)] leading-relaxed text-pretty text-white/85">
                {props.subtitle}
              </p>
            )}
          </div>

          <Ticket id={id} props={props} extras={extras} />
        </div>
      </div>
    </Section>
  );
}

function Ticket({
  id,
  props,
  extras,
}: {
  id: string;
  props: ReservationCtaProps;
  extras: Extras;
}) {
  const tel = extras.phone.replace(/[^+\d]/g, "");
  return (
    <div className="ticket-stub w-full max-w-md justify-self-start rounded-[calc(var(--radius)*1.8)] bg-background text-foreground shadow-[0_40px_80px_-30px_rgba(0,0,0,0.75)] [--stub:7.75rem] lg:max-w-none lg:rotate-[1.25deg] lg:transition-transform lg:duration-500 lg:hover:rotate-0">
      <div className="p-5 pb-6 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="font-semibold">Book a table</p>
          {extras.hours && (
            <OpenStatus
              hours={extras.hours}
              className="text-xs text-foreground/65"
            />
          )}
        </div>

        <PartyPicker
          id={`${id}-party`}
          href={props.cta.href}
          extras={extras}
          className="mt-5"
        />
      </div>

      <div
        aria-hidden="true"
        className="mx-4 border-t-2 border-dashed border-foreground/12"
      />

      <div className="flex h-31 flex-col justify-center gap-2.5 px-5 sm:px-6">
        <Link
          href={props.cta.href}
          className={cn(
            "inline-flex h-13 w-full items-center justify-center rounded-[calc(var(--radius)*1.2)] bg-primary px-6 font-semibold text-white shadow-lg shadow-primary/30 transition hover:brightness-110 active:translate-y-px",
            FOCUS,
          )}
        >
          {props.cta.label}
        </Link>
        {tel && (
          <a
            href={`tel:${tel}`}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground",
              FOCUS,
            )}
          >
            <Phone aria-hidden="true" className="size-3.5" />
            Rather call?{" "}
            <span className="font-medium tabular-nums">{extras.phone}</span>
          </a>
        )}
      </div>
    </div>
  );
}

function Inline({
  id,
  props,
  extras,
}: {
  id: string;
  props: ReservationCtaProps;
  extras: Extras;
}) {
  const tel = extras.phone.replace(/[^+\d]/g, "");
  return (
    <Section id={id} className={cn(displayFonts, "py-14 min-[900px]:py-20")}>
      <div className="ticket-side group/cta mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[calc(var(--radius)*2.2)] bg-[color-mix(in_oklab,var(--primary)_7%,var(--background))] text-foreground ring-1 ring-primary/15 ring-inset [--stub:21rem] md:grid-cols-[minmax(0,1fr)_21rem] lg:grid-cols-[13rem_minmax(0,1fr)_21rem]">
        <div className="relative hidden overflow-hidden lg:block">
          <Image
            src={`/${props.image}`}
            alt=""
            fill
            sizes="208px"
            className="object-cover transition-transform duration-1800 ease-out group-hover/cta:scale-[1.06] motion-reduce:transition-none"
            style={{ objectPosition: props.imagePosition }}
          />
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-4 p-6 sm:p-8 lg:p-10">
          <DisplayTitle
            id={`${id}-title`}
            title={props.title}
            tone="light"
            className="text-[clamp(2rem,4vw,3.25rem)]"
          />
          {props.subtitle && (
            <p className="max-w-[46ch] leading-relaxed text-pretty text-foreground/70">
              {props.subtitle}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/70">
            {extras.hours && <OpenStatus hours={extras.hours} />}
            {tel && (
              <a
                href={`tel:${tel}`}
                className={cn(
                  "inline-flex items-center gap-1.5 tabular-nums transition-colors hover:text-foreground",
                  FOCUS,
                )}
              >
                <Phone aria-hidden="true" className="size-3.5" />
                {extras.phone}
              </a>
            )}
          </div>
        </div>

        <div className="relative flex flex-col justify-center gap-5 border-t-2 border-dashed border-primary/20 p-6 sm:p-8 md:border-t-0 md:border-l-2">
          <PartyPicker
            id={`${id}-party`}
            href={props.cta.href}
            extras={extras}
          />
          <Link
            href={props.cta.href}
            className={cn(
              "inline-flex h-13 w-full items-center justify-center rounded-[calc(var(--radius)*1.2)] bg-primary px-6 font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-110 active:translate-y-px",
              FOCUS,
            )}
          >
            {props.cta.label}
          </Link>
        </div>
      </div>
    </Section>
  );
}

function PartyPicker({
  id,
  href,
  extras,
  className,
}: {
  id: string;
  href: string;
  extras: Extras;
  className?: string;
}) {
  if (!extras.sizes.length) return null;
  const more = extras.max > Math.max(...extras.sizes);
  return (
    <div className={className}>
      <p id={id} className="text-sm text-foreground/60">
        How many guests?
      </p>
      <div
        role="group"
        aria-labelledby={id}
        className="mt-2.5 grid grid-cols-4 gap-2"
      >
        {extras.sizes.map((n) => (
          <Link
            key={n}
            href={withParty(href, n)}
            aria-label={`Book for ${n} guests`}
            className={cn(
              "grid h-12 place-items-center rounded-xl border border-foreground/12 bg-background/60 text-lg font-semibold tabular-nums transition-colors hover:border-primary hover:bg-primary hover:text-white",
              FOCUS,
            )}
          >
            {n}
          </Link>
        ))}
        {more && (
          <Link
            href={href}
            aria-label="Book for a bigger group"
            className={cn(
              "grid h-12 place-items-center rounded-xl border border-dashed border-foreground/20 text-sm font-medium text-foreground/70 transition-colors hover:border-primary hover:text-primary",
              FOCUS,
            )}
          >
            More
          </Link>
        )}
      </div>
    </div>
  );
}
