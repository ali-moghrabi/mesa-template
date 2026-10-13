import { z } from "zod";
import { getConfig } from "@/config/loader";
import { cn } from "@/lib/utils";
import { StatValue } from "./StatValue";

export const STATS_VARIANTS = ["inline", "cards"] as const;
export type StatsVariant = (typeof STATS_VARIANTS)[number];

type Stat = { value: string; label: string };

const sectionSchema = z.object({
  id: z.string().catch("stats"),
  variant: z.enum(STATS_VARIANTS).catch("inline"),
  enabled: z.boolean().catch(true),
  props: z
    .object({
      eyebrow: z.string().optional().catch(undefined),
      title: z.string().optional().catch(undefined),
      subtitle: z.string().optional().catch(undefined),
    })
    .catch({}),
});

const statsSchema = z
  .array(z.object({ value: z.string().min(1), label: z.string().min(1) }))
  .catch([]);

type Section = z.infer<typeof sectionSchema>;

function homeSection(): unknown {
  const pages = (
    getConfig() as unknown as {
      pages?: { home?: { sections?: { type?: string }[] } };
    }
  ).pages;
  return pages?.home?.sections?.find((s) => s?.type === "stats") ?? {};
}

type Props = {
  section?: unknown;
};

export default function StatsPreview({ section }: Props) {
  const config = sectionSchema.parse(section ?? homeSection());
  if (!config.enabled) return null;

  const stats = statsSchema
    .parse(
      (getConfig() as unknown as { content?: { stats?: unknown } }).content
        ?.stats,
    )
    .slice(0, 6);
  if (stats.length === 0) return null;

  return config.variant === "cards" ? (
    <CardsLook config={config} stats={stats} />
  ) : (
    <InlineLook config={config} stats={stats.slice(0, 4)} />
  );
}

type LookProps = { config: Section; stats: Stat[] };

function Heading({
  config,
  className,
}: {
  config: Section;
  className?: string;
}) {
  if (!config.props.title) return null;
  return (
    <div className={cn("max-w-xl", className)}>
      {config.props.eyebrow && (
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          {config.props.eyebrow}
        </p>
      )}
      <h2
        id={`${config.id}-title`}
        className="mt-3 text-[clamp(2rem,4vw,3rem)] leading-[1.05] font-medium tracking-[-0.035em] text-balance"
      >
        {config.props.title}
      </h2>
      {config.props.subtitle && (
        <p className="mt-3 text-lg text-pretty text-foreground/70">
          {config.props.subtitle}
        </p>
      )}
    </div>
  );
}

const columns = (n: number) =>
  n === 4 ? "lg:grid-cols-4" : n === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";

function InlineLook({ config, stats }: LookProps) {
  return (
    <section
      id={config.id}
      aria-labelledby={config.props.title ? `${config.id}-title` : undefined}
      aria-label={config.props.title ? undefined : "In numbers"}
      className="px-(--pad) py-16 [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <Heading config={config} className="mb-10 sm:mb-14" />
        <dl
          className={cn(
            "grid grid-cols-2 border-y border-foreground/12",
            columns(stats.length),
          )}
        >
          {stats.map((stat, i) => (
            <div
              key={`${stat.label}-${i}`}
              className={cn(
                "flex flex-col items-center px-4 py-9 text-center sm:py-12",
                i % 2 === 1 && "border-l border-foreground/12",
                i >= 2 && "max-lg:border-t max-lg:border-foreground/12",
                i % 2 === 0 && i > 0 && "lg:border-l lg:border-foreground/12",
              )}
            >
              <dt className="order-2 mt-2 max-w-[14ch] text-sm font-medium tracking-wide text-foreground/60 sm:text-base">
                {stat.label}
              </dt>
              <dd className="order-1 text-[clamp(2.75rem,6.5vw,4.75rem)] leading-none font-medium tracking-tighter tabular-nums">
                <StatValue value={stat.value} suffixClassName="text-primary" />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function CardsLook({ config, stats }: LookProps) {
  return (
    <section
      id={config.id}
      aria-labelledby={config.props.title ? `${config.id}-title` : undefined}
      aria-label={config.props.title ? undefined : "In numbers"}
      className="px-(--pad) py-20 [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <Heading config={config} className="mb-10 sm:mb-12" />
        <dl
          className={cn(
            "grid grid-cols-2 gap-3 sm:gap-5",
            columns(stats.length),
          )}
        >
          {stats.map((stat, i) => (
            <div
              key={`${stat.label}-${i}`}
              className={cn(
                "group relative isolate flex min-h-44 flex-col justify-between overflow-hidden rounded-[calc(var(--radius)*2)] border p-5 transition-all duration-300 hover:-translate-y-1 sm:min-h-52 sm:p-7",
                i === 0
                  ? "border-transparent bg-primary text-primary-foreground shadow-[0_24px_50px_-28px_var(--primary)]"
                  : "border-foreground/10 bg-card hover:border-primary/30 hover:shadow-[0_24px_50px_-34px_rgb(0_0_0/0.35)]",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -top-14 -right-14 -z-10 size-40 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125",
                  i === 0 ? "bg-white/15" : "bg-primary/10",
                )}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  i === 0 ? "text-primary-foreground/70" : "text-foreground/35",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col">
                <dt
                  className={cn(
                    "order-2 mt-2 text-sm font-medium sm:text-base",
                    i === 0
                      ? "text-primary-foreground/80"
                      : "text-foreground/60",
                  )}
                >
                  {stat.label}
                </dt>
                <dd className="order-1 text-[clamp(2.4rem,5vw,3.75rem)] leading-none font-medium tracking-tighter tabular-nums">
                  <StatValue
                    value={stat.value}
                    suffixClassName={
                      i === 0 ? "text-primary-foreground/70" : "text-primary"
                    }
                  />
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
