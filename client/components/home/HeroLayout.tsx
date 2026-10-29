import Link from "next/link";
import type { CSSProperties } from "react";
import { MapPin, Phone } from "lucide-react";
import type { SiteConfig } from "@/config/schema";
import { OpenStatus } from "@/components/common/OpenStatus";
import { getOpeningHours } from "@/lib/opening-hours-server";
import { cn } from "@/lib/utils";
import { BookingBar } from "./BookingBar";
import type { HeroProps } from "./schema";
import { HeroMedia, HeroMediaControls, type HeroVariant } from "./HeroMedia";
import { displayFonts, parseTitle } from "./display-title";
import "./hero.css";

export type HeroLayoutProps = {
  props: HeroProps;
  variant: string;
  business: SiteConfig["business"];
  reservationsEnabled: boolean;
};

const BUTTON =
  "inline-flex min-h-13.5 items-center justify-center rounded-[calc(var(--radius)*1.2)] px-7 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

const VARIANTS: HeroVariant[] = ["fullscreen", "video", "slider"];

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

async function HeroLayout({
  props,
  variant,
  business,
  reservationsEnabled,
}: HeroLayoutProps) {
  const hours = await getOpeningHours();
  const { primaryCta, secondaryCta } = props;
  const showBooking =
    props.booking && reservationsEnabled && Boolean(primaryCta);
  const kind: HeroVariant = VARIANTS.includes(variant as HeroVariant)
    ? (variant as HeroVariant)
    : "fullscreen";

  const { words, end } = parseTitle(props.title);
  const plainTitle = props.title.replace(/\*/g, "");
  const wordsDone = words.length * 75 + 520 + 300;

  const { street, city } = business.address;
  const { geo } = business;
  const mapsHref = geo
    ? `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${street}, ${city}`)}`;

  return (
    <section
      data-nav-dark=""
      aria-labelledby="hero-title"
      className={cn(
        displayFonts,
        "relative isolate flex min-h-svh flex-col overflow-hidden bg-neutral-950 text-white [--pad:clamp(1.1rem,4vw,3.5rem)]",
      )}
    >
      <HeroMedia
        variant={kind}
        image={props.image}
        slides={props.slides ?? []}
        interval={props.interval ?? 8000}
        video={props.video}
        webm={props.videoWebm}
        poster={props.poster}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ backgroundColor: `rgba(0,0,0,${props.overlay})` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_0%_100%,rgba(0,0,0,.78)_0%,rgba(0,0,0,.35)_45%,transparent_75%),linear-gradient(180deg,rgba(0,0,0,.55)_0%,transparent_26%)]"
        />
        <div
          aria-hidden="true"
          className="bg-grain pointer-events-none absolute inset-0 -z-10 opacity-[0.07] mix-blend-overlay"
        />

        <div className="hero-recede flex flex-1 flex-col justify-end px-(--pad) pt-32 pb-8 sm:pb-12">
          <h1
            id="hero-title"
            aria-label={plainTitle}
            className="hero-title max-w-[15ch] text-[clamp(3.1rem,9.2vw,8.5rem)] text-balance"
          >
            {words.map((word, i) => {
              const last = i === words.length - 1;
              return (
                <span key={i} aria-hidden="true">
                  <span
                    className={cn(
                      "hero-word-mask",
                      word.accent && "hero-accent-mask",
                    )}
                  >
                    <span
                      className={cn("hero-word", word.accent && "hero-accent")}
                      style={{ "--i": i } as CSSProperties}
                    >
                      {word.text}
                      {last && end ? (
                        <span className="hero-end">{end}</span>
                      ) : null}
                    </span>
                  </span>
                  {last ? null : " "}
                </span>
              );
            })}
          </h1>

          {props.subtitle && (
            <p
              className="hero-in mt-6 max-w-[46ch] text-[clamp(1.02rem,1.9vw,1.2rem)] leading-relaxed text-pretty text-white/85"
              style={delay(wordsDone)}
            >
              {props.subtitle}
            </p>
          )}

          <div
            className="hero-in mt-8 flex flex-col gap-3 sm:flex-row sm:items-stretch"
            style={delay(wordsDone + 120)}
          >
            {showBooking && primaryCta ? (
              <BookingBar
                label={primaryCta.label}
                action={primaryCta.href}
                minPartySize={business.reservations.minPartySize}
                maxPartySize={business.reservations.maxPartySize}
                advanceDays={business.reservations.advanceDays}
                timezone={business.timezone}
                className="sm:flex-1"
              />
            ) : (
              primaryCta && (
                <Link
                  href={primaryCta.href}
                  className={cn(
                    BUTTON,
                    "bg-primary text-white shadow-lg shadow-primary/35 hover:brightness-110",
                  )}
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
                  "shrink-0 bg-white/6 ring-1 ring-white/30 backdrop-blur-md ring-inset hover:bg-white hover:text-neutral-950",
                  showBooking && "sm:self-center",
                )}
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
        </div>

        <div
          className="hero-in border-t border-white/15 px-(--pad)"
          style={delay(wordsDone + 260)}
        >
          <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm text-white/80">
              {hours && (
                <OpenStatus
                  hours={hours}
                  className="rounded-full bg-white/10 px-3.5 py-1.5 text-white ring-1 ring-white/15 backdrop-blur-md"
                />
              )}
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 transition-colors hover:text-white"
              >
                <MapPin aria-hidden="true" className="size-4 text-white/60" />
                {street}, {city}
              </a>
              <a
                href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}
                className="inline-flex items-center gap-2 tabular-nums transition-colors hover:text-white"
              >
                <Phone aria-hidden="true" className="size-4 text-white/60" />
                {business.phone}
              </a>
            </div>
            <HeroMediaControls />
          </div>
        </div>
      </HeroMedia>
    </section>
  );
}

export default HeroLayout;
