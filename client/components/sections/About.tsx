import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  ChefHat,
  Clock,
  Coffee,
  Fish,
  Flame,
  Heart,
  Leaf,
  MapPin,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Users,
  UtensilsCrossed,
  Wheat,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { cn } from "@/lib/utils";

export const ABOUT_VARIANTS = ["split", "stacked"] as const;

const ICONS: Record<string, LucideIcon> = {
  leaf: Leaf,
  flame: Flame,
  heart: Heart,
  wheat: Wheat,
  sprout: Sprout,
  fish: Fish,
  wine: Wine,
  coffee: Coffee,
  chef: ChefHat,
  award: Award,
  star: Star,
  users: Users,
  clock: Clock,
  map: MapPin,
  sun: Sun,
  utensils: UtensilsCrossed,
};

const sectionSchema = z.object({
  id: z.string().catch("about"),
  variant: z.enum(ABOUT_VARIANTS).catch("split"),
  enabled: z.boolean().catch(true),
  props: z
    .object({
      imagePosition: z.enum(["start", "end"]).catch("start"),
      hideCta: z.boolean().catch(false),
    })
    .catch({ imagePosition: "start", hideCta: false }),
});

const aboutSchema = z.object({
  eyebrow: z.string().optional().catch(undefined),
  title: z.string().min(1),
  body: z.array(z.string()).catch([]),
  image: z.string().optional().catch(undefined),
  highlights: z
    .array(
      z.object({
        icon: z.string().catch(""),
        title: z.string(),
        text: z.string().catch(""),
      }),
    )
    .catch([]),
  cta: z
    .object({ label: z.string(), href: z.string() })
    .optional()
    .catch(undefined),
});

const statsSchema = z
  .array(z.object({ value: z.string(), label: z.string() }))
  .catch([]);

const src = (path: string) =>
  /^(https?:\/\/|\/|data:)/.test(path) ? path : `/${path}`;

type Props = {
  section?: unknown;
  pathname?: string;
};

function homeSection(): unknown {
  const pages = (
    getConfig() as unknown as {
      pages?: { home?: { sections?: { type?: string }[] } };
    }
  ).pages;
  return pages?.home?.sections?.find((s) => s?.type === "about") ?? {};
}

export default function About({ section, pathname }: Props) {
  const config = sectionSchema.parse(section ?? homeSection());
  if (!config.enabled) return null;

  const site = getConfig() as unknown as {
    brand: { name: string; tagline?: string };
    content?: { about?: unknown; stats?: unknown };
  };
  const parsed = aboutSchema.safeParse(site.content?.about);
  if (!parsed.success) return null;
  const about = parsed.data;
  const stat = statsSchema.parse(site.content?.stats)[0];
  const cta =
    about.cta && !config.props.hideCta && about.cta.href !== pathname
      ? about.cta
      : undefined;
  const [lead, ...rest] = about.body;

  const words = about.title.trim().split(/\s+/);
  const last = words.pop() ?? "";
  const title = (
    <>
      {words.length > 0 && `${words.join(" ")} `}
      <span className="text-primary italic">{last}</span>
    </>
  );

  const eyebrow = about.eyebrow && (
    <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
      <span aria-hidden="true" className="h-px w-8 bg-primary/60" />
      {about.eyebrow}
    </p>
  );

  const ctaLink = cta && (
    <Link
      href={cta.href}
      className="group inline-flex h-12 items-center gap-2 rounded-full bg-foreground pr-5 pl-6 font-semibold text-background transition-opacity hover:opacity-90"
    >
      {cta.label}
      <span className="grid size-7 place-items-center rounded-full bg-background/15 transition-transform group-hover:translate-x-0.5">
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );

  if (config.variant === "stacked") {
    return (
      <section
        id={config.id}
        aria-labelledby={`${config.id}-title`}
        className="overflow-hidden bg-background px-(--pad) py-20 text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-28"
      >
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow}
          <h2
            id={`${config.id}-title`}
            className="mt-5 text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.02] font-medium tracking-[-0.04em] text-balance"
          >
            {title}
          </h2>
          {lead && (
            <p className="mt-6 text-xl leading-relaxed text-pretty text-foreground/80 sm:text-[1.35rem]">
              {lead}
            </p>
          )}
          {rest.map((p) => (
            <p
              key={p}
              className="mt-4 text-lg leading-relaxed text-pretty text-foreground/65"
            >
              {p}
            </p>
          ))}
          {ctaLink && <div className="mt-8 flex justify-center">{ctaLink}</div>}
        </div>

        {about.image && (
          <div
            className={cn(
              "relative mx-auto mt-14 max-w-6xl sm:mt-16",
              about.highlights.length > 0 && "lg:mb-24",
            )}
          >
            <div className="relative aspect-4/3 overflow-hidden rounded-[calc(var(--radius)*2.6)] sm:aspect-21/9">
              <Image
                src={src(about.image)}
                alt=""
                fill
                sizes="(min-width: 1200px) 1150px, 100vw"
                className="object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent"
              />
            </div>
            {about.highlights.length > 0 && (
              <ul className="mt-4 grid gap-3 sm:grid-cols-3 lg:absolute lg:inset-x-10 lg:-bottom-20 lg:mt-0 lg:gap-4">
                {about.highlights.slice(0, 3).map((h) => (
                  <Highlight key={h.title} item={h} tone="card" />
                ))}
              </ul>
            )}
          </div>
        )}
        {!about.image && about.highlights.length > 0 && (
          <ul className="mx-auto mt-12 grid max-w-5xl gap-3 sm:grid-cols-3">
            {about.highlights.map((h) => (
              <Highlight key={h.title} item={h} tone="card" />
            ))}
          </ul>
        )}
      </section>
    );
  }

  const imageEnd = config.props.imagePosition === "end";
  return (
    <section
      id={config.id}
      aria-labelledby={`${config.id}-title`}
      className="overflow-hidden bg-background px-(--pad) py-20 text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-28"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-2 lg:gap-20">
        {about.image && (
          <div
            className={cn(
              "relative mx-auto w-full max-w-lg lg:max-w-none",
              imageEnd && "lg:order-2",
            )}
          >
            <div
              aria-hidden="true"
              className={cn(
                "absolute inset-0 z-0 rounded-[calc(var(--radius)*2.8)] bg-primary/12",
                imageEnd
                  ? "translate-x-4 translate-y-4 sm:translate-x-6 sm:translate-y-6"
                  : "-translate-x-4 translate-y-4 sm:-translate-x-6 sm:translate-y-6",
              )}
            />
            <div className="relative aspect-4/5 overflow-hidden rounded-[calc(var(--radius)*2.8)] shadow-[0_40px_80px_-40px_rgba(0,0,0,.45)]">
              <Image
                src={src(about.image)}
                alt=""
                fill
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="object-cover transition-transform duration-[1.2s] ease-out hover:scale-[1.04]"
              />
            </div>

            <Stamp
              text={site.brand.tagline || site.brand.name}
              className={cn(
                "absolute -top-8 size-28 sm:size-32",
                imageEnd ? "-left-6 sm:-left-10" : "-right-6 sm:-right-10",
              )}
            />

            {stat && (
              <div
                className={cn(
                  "absolute -bottom-7 rounded-2xl bg-card px-5 py-4 shadow-[0_24px_50px_-24px_rgba(0,0,0,.5)] ring-1 ring-foreground/8",
                  imageEnd ? "right-4 sm:-right-6" : "left-4 sm:-left-6",
                )}
              >
                <p className="text-4xl leading-none font-semibold tracking-tight text-primary tabular-nums">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-sm font-medium text-foreground/65">
                  {stat.label}
                </p>
              </div>
            )}
          </div>
        )}

        <div className={cn(!about.image && "mx-auto max-w-3xl lg:col-span-2")}>
          {eyebrow}
          <h2
            id={`${config.id}-title`}
            className="mt-5 text-[clamp(2.3rem,5vw,3.75rem)] leading-[1.03] font-medium tracking-[-0.04em] text-balance"
          >
            {title}
          </h2>
          {lead && (
            <p className="mt-6 text-xl leading-relaxed text-pretty text-foreground/80">
              {lead}
            </p>
          )}
          {rest.map((p) => (
            <p
              key={p}
              className="mt-4 text-lg leading-relaxed text-pretty text-foreground/65"
            >
              {p}
            </p>
          ))}

          {about.highlights.length > 0 && (
            <ul className="mt-9 grid gap-3 border-t border-foreground/10 pt-8 sm:grid-cols-2 xl:grid-cols-3">
              {about.highlights.map((h) => (
                <Highlight key={h.title} item={h} tone="plain" />
              ))}
            </ul>
          )}
          {ctaLink && <div className="mt-9">{ctaLink}</div>}
        </div>
      </div>
    </section>
  );
}

function Highlight({
  item,
  tone,
}: {
  item: { icon: string; title: string; text: string };
  tone: "plain" | "card";
}) {
  const Icon = ICONS[item.icon.toLowerCase()] ?? Sparkles;
  return (
    <li
      className={cn(
        "flex gap-3.5",
        tone === "card" &&
          "rounded-2xl bg-card/95 p-5 shadow-[0_24px_60px_-34px_rgba(0,0,0,.5)] ring-1 ring-foreground/8 backdrop-blur-md",
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{item.title}</span>
        {item.text && (
          <span className="mt-0.5 block text-sm leading-relaxed text-foreground/60">
            {item.text}
          </span>
        )}
      </span>
    </li>
  );
}

function Stamp({ text, className }: { text: string; className?: string }) {
  const ring = `${text} · ${text} · `.toUpperCase();
  return (
    <div
      aria-hidden="true"
      className={cn(
        "z-10 grid place-items-center rounded-full bg-primary text-white shadow-[0_18px_40px_-18px_var(--primary)]",
        className,
      )}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full motion-safe:animate-[spin_24s_linear_infinite]"
      >
        <defs>
          <path
            id="about-stamp-circle"
            d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0"
          />
        </defs>
        <text className="fill-current text-[8.5px] font-semibold tracking-[0.18em]">
          <textPath
            href="#about-stamp-circle"
            textLength="230"
            lengthAdjust="spacingAndGlyphs"
          >
            {ring}
          </textPath>
        </text>
      </svg>
      <Sparkles className="size-6" />
    </div>
  );
}
