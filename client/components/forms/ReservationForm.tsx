import Image from "next/image";
import {
  CalendarClock,
  Clock,
  Hourglass,
  MailCheck,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { getUserSession } from "@/lib/auth/get-user";
import { getOpeningHours } from "@/lib/opening-hours-server";
import {
  getAvailability,
  reservationsEnabled,
} from "@/lib/reservations-server";
import type { Availability, BookingPrefill } from "@/lib/reservations";
import { cn } from "@/lib/utils";
import { LiveStatus, WeekTable } from "@/components/home/HoursLive";
import { BookingForm } from "./BookingForm";

export const RESERVATION_FORM_VARIANTS = ["inline", "split"] as const;

const sectionSchema = z.object({
  id: z.string().catch("reservation-form"),
  variant: z.enum(RESERVATION_FORM_VARIANTS).catch("inline"),
  enabled: z.boolean().catch(true),
  props: z
    .object({
      eyebrow: z.string().optional().catch(undefined),
      title: z.string().optional().catch(undefined),
      subtitle: z.string().optional().catch(undefined),
      image: z.string().optional().catch(undefined),
    })
    .catch({}),
});

type Props = {
  section: unknown;
  prefill?: BookingPrefill;
};

const src = (path: string) =>
  /^(https?:\/\/|\/|data:)/.test(path) ? path : `/${path}`;

export default async function ReservationForm({ section, prefill }: Props) {
  const config = sectionSchema.parse(section ?? {});
  if (!config.enabled || !reservationsEnabled()) return null;

  const site = getConfig() as unknown as {
    brand: { name: string };
    business: {
      phone?: string;
      address?: { street?: string; city?: string; country?: string } | string;
    };
    locale?: { timeFormat?: string };
  };
  const [result, user, hours] = await Promise.all([
    getAvailability(),
    getUserSession(),
    config.variant === "split" ? getOpeningHours() : null,
  ]);

  const timeFormat = site.locale?.timeFormat === "12h" ? "12h" : "24h";
  const address =
    typeof site.business.address === "string"
      ? site.business.address
      : [
          site.business.address?.street,
          site.business.address?.city,
          site.business.address?.country,
        ]
          .filter(Boolean)
          .join(", ");
  const restaurant = {
    name: site.brand.name,
    phone: site.business.phone ?? "",
    address,
  };
  const tel = restaurant.phone.replace(/[^+\d]/g, "");

  const { eyebrow, title, subtitle, image } = config.props;
  const account = user
    ? {
        firstName: user.firstName ?? "",
        name:
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.email,
        email: user.email,
        phone: (user as { phone?: string }).phone ?? "",
      }
    : null;

  const form = result.ok ? (
    <BookingForm
      availability={result.data}
      signedIn={Boolean(user)}
      account={account}
      prefill={prefill}
      timeFormat={timeFormat}
      restaurant={restaurant}
      layout={config.variant}
    />
  ) : (
    <div
      role="alert"
      className="rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-muted px-6 py-12 text-center"
    >
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-background text-primary shadow-sm">
        <CalendarClock className="size-6" />
      </span>
      <p className="mt-5 text-xl font-medium">
        Online booking is taking a break
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-pretty text-foreground/65">
        {result.message} Call us and we&apos;ll find you a table.
      </p>
      {tel && (
        <a
          href={`tel:${tel}`}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 font-semibold text-background"
        >
          <Phone className="size-4" /> {restaurant.phone}
        </a>
      )}
    </div>
  );

  const heading = (title || subtitle || eyebrow) && (
    <div className={cn("mb-8", config.variant === "inline" && "text-center")}>
      {eyebrow && (
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className="mt-2 text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
          {title}
        </h2>
      )}
      {subtitle && (
        <p
          className={cn(
            "mt-3 max-w-xl text-lg text-pretty text-foreground/65",
            config.variant === "inline" && "mx-auto",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );

  if (config.variant === "split") {
    return (
      <section
        id={config.id}
        className="bg-background px-(--pad) py-14 text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-20"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <aside className="relative isolate flex min-h-104 flex-col justify-end overflow-hidden rounded-[calc(var(--radius)*2.4)] bg-secondary p-6 text-white sm:p-8 lg:sticky lg:top-[calc(var(--nav-height,4.5rem)+1.5rem)] lg:self-start">
            {image ? (
              <Image
                src={src(image)}
                alt=""
                fill
                sizes="(min-width:1024px) 40vw, 100vw"
                className="-z-20 object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-20 bg-[radial-gradient(120%_80%_at_0%_0%,var(--primary),transparent_60%),radial-gradient(90%_70%_at_100%_100%,var(--accent),transparent_55%)] opacity-70"
              />
            )}
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/45 to-black/10"
            />
            {hours && (
              <LiveStatus
                hours={hours}
                timeFormat={timeFormat}
                tone="inverted"
                className="mb-auto self-start"
              />
            )}
            <div className="mt-24">
              <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">
                How it works
              </p>
              <ul className="mt-4 space-y-3.5 text-[15px] text-white/90">
                {result.ok && (
                  <Fact icon={Users}>
                    Tables for up to {result.data.rules.maxPartySize} guests
                    online
                  </Fact>
                )}
                {result.ok && (
                  <Fact icon={CalendarClock}>
                    Book up to {result.data.rules.advanceDays} days ahead
                  </Fact>
                )}
                {result.ok && result.data.rules.minNoticeMinutes > 0 && (
                  <Fact icon={Hourglass}>
                    At least {notice(result.data)} before your table
                  </Fact>
                )}
                <Fact icon={MailCheck}>
                  We confirm by email, usually within a few hours
                </Fact>
              </ul>
              {hours && (
                <details className="group mt-6 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md">
                  <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
                    <Clock className="size-4" /> Opening hours
                    <span className="ml-auto text-white/60 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <WeekTable
                    hours={hours}
                    timeFormat={timeFormat}
                    className="mt-3 text-sm [&_dl>div]:mx-0 [&_dl>div]:px-0"
                  />
                </details>
              )}
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
                {address && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" /> {address}
                  </span>
                )}
                {tel && (
                  <a
                    href={`tel:${tel}`}
                    className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                  >
                    <Phone className="size-4" /> {restaurant.phone}
                  </a>
                )}
              </div>
            </div>
          </aside>
          <div className="min-w-0">
            {heading}
            {form}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id={config.id}
      className="bg-background px-(--pad) py-12 text-foreground [--pad:clamp(1rem,4vw,3.5rem)] sm:py-16"
    >
      <div className="mx-auto max-w-3xl">
        {heading}
        {form}
        {result.ok && (
          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-foreground/55">
            <li className="inline-flex items-center gap-1.5">
              <MailCheck className="size-4" /> Confirmed by email
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" /> Up to{" "}
              {result.data.rules.advanceDays} days ahead
            </li>
            {tel && (
              <li>
                <a
                  href={`tel:${tel}`}
                  className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline"
                >
                  <Phone className="size-4" /> {restaurant.phone}
                </a>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}

function notice(a: Availability) {
  const m = a.rules.minNoticeMinutes;
  if (m % 60 === 0) return `${m / 60} ${m === 60 ? "hour" : "hours"}`;
  return `${m} minutes`;
}

function Fact({
  icon: Icon,
  children,
}: {
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/12 ring-1 ring-white/15">
        <Icon className="size-4" />
      </span>
      {children}
    </li>
  );
}
