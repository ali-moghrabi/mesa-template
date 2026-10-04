import Image from "next/image";
import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import type { SiteConfig } from "@/config/schema";
import { OpenStatus } from "@/components/common/OpenStatus";
import { cn } from "@/lib/utils";
import { BookingBar } from "./BookingBar";
import type { HeroProps } from "./schema";

export type HeroFullscreenProps = {
  props: HeroProps;
  business: SiteConfig["business"];
  reservationsEnabled: boolean;
};

const BUTTON =
  "inline-flex min-h-[54px] items-center justify-center rounded-[calc(var(--radius)*1.1)] px-7 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function HeroFullscreen({
  props,
  business,
  reservationsEnabled,
}: HeroFullscreenProps) {
  const { primaryCta, secondaryCta } = props;
  const showBooking =
    props.booking && reservationsEnabled && Boolean(primaryCta);

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-svh flex-col justify-end overflow-hidden bg-[#1b120c] text-white [--pad:clamp(1.1rem,4vw,3.5rem)]"
    >
      <div className="absolute inset-0 -z-10 animate-settle motion-reduce:animate-none">
        <Image
          src={`/${props.image}`}
          alt=""
          preload
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div
        className="absolute inset-0 -z-10"
        style={{ backgroundColor: `rgba(0,0,0,${props.overlay})` }}
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(0,0,0,.7),transparent_55%),linear-gradient(180deg,rgba(0,0,0,.5),transparent_28%)]" />

      <div className="px-(--pad) pt-36 pb-[calc(var(--pad)*0.9)]">
        <div className="animate-rise motion-reduce:animate-none">
          <h1
            id="hero-title"
            className="max-w-[13ch] text-[clamp(3.25rem,10.5vw,9rem)] leading-[0.92] font-medium tracking-[-0.055em] text-balance capitalize"
          >
            {props.title}
          </h1>

          {props.subtitle && (
            <p className="mt-6 max-w-136 text-[clamp(1rem,2.1vw,1.15rem)] leading-normal text-pretty text-white/90">
              {props.subtitle}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {showBooking && primaryCta ? (
              <BookingBar
                label={primaryCta.label}
                maxPartySize={business.reservations.maxPartySize}
                className="sm:flex-1"
              />
            ) : (
              primaryCta && (
                <Link
                  href={primaryCta.href}
                  className={cn(BUTTON, "bg-primary text-primary-foreground")}
                >
                  {primaryCta.label}
                </Link>
              )
            )}
            {secondaryCta && (
              <Link
                href={secondaryCta.href}
                className={cn(
                  BUTTON,
                  "shrink-0 border border-white/45 transition-colors hover:bg-white/10",
                )}
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/85">
            {business.hours && (
              <OpenStatus
                hours={business.hours}
                specialHours={business.specialHours}
                timezone={business.timezone}
              />
            )}
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden="true" className="size-4" />
              {business.address.street}, {business.address.city}
            </span>
            <a
              href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}
              className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
            >
              <Phone aria-hidden="true" className="size-4" />
              {business.phone}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
