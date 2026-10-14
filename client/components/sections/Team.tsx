import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { cn } from "@/lib/utils";
import { Rail } from "@/components/common/Rail";

export const TEAM_VARIANTS = ["grid", "carousel"] as const;

const sectionSchema = z.object({
  id: z.string().catch("team"),
  variant: z.enum(TEAM_VARIANTS).catch("grid"),
  enabled: z.boolean().catch(true),
  props: z
    .object({
      eyebrow: z.string().catch("The team"),
      title: z.string().catch("The people behind the plates"),
      subtitle: z.string().optional().catch(undefined),
    })
    .catch({ eyebrow: "The team", title: "The people behind the plates" }),
});

const memberSchema = z.object({
  name: z.string().min(1),
  role: z.string().catch(""),
  bio: z.string().optional().catch(undefined),
  image: z.string().optional().catch(undefined),
  links: z.array(z.object({ label: z.string(), url: z.url() })).catch([]),
});
type Member = z.infer<typeof memberSchema>;

const src = (path: string) =>
  /^(https?:\/\/|\/|data:)/.test(path) ? path : `/${path}`;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

export default function Team({ section }: { section?: unknown }) {
  const config = sectionSchema.parse(section ?? {});
  if (!config.enabled) return null;

  const raw = (getConfig() as unknown as { content?: { team?: unknown } })
    .content?.team;
  const team = (Array.isArray(raw) ? raw : []).flatMap((m) => {
    const one = memberSchema.safeParse(m);
    return one.success ? [one.data] : [];
  });
  if (team.length === 0) return null;

  const { eyebrow, title, subtitle } = config.props;
  const header = (
    <div className="max-w-2xl">
      <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
        <span aria-hidden="true" className="h-px w-8 bg-primary/60" />
        {eyebrow}
      </p>
      <h2
        id={`${config.id}-title`}
        className="mt-4 text-[clamp(2.2rem,5vw,3.5rem)] leading-[1.03] font-medium tracking-[-0.04em] text-balance"
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-lg text-pretty text-foreground/65">
          {subtitle}
        </p>
      )}
    </div>
  );

  return (
    <section
      id={config.id}
      aria-labelledby={`${config.id}-title`}
      className="bg-muted/40 px-(--pad) py-20 text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-28"
    >
      <div className="mx-auto max-w-7xl">
        {config.variant === "carousel" ? (
          <Rail header={header} label="team members">
            {team.map((m, i) => (
              <li
                key={m.name}
                className="w-[78%] shrink-0 snap-start sm:w-[44%] lg:w-[31%] xl:w-[23.5%]"
              >
                <MemberCard member={m} index={i} />
              </li>
            ))}
          </Rail>
        ) : (
          <>
            {header}
            <ul
              className={cn(
                "mt-12 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-6",
                team.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
              )}
            >
              {team.map((m, i) => (
                <li key={m.name}>
                  <MemberCard member={m} index={i} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

const MONOGRAMS = [
  "from-primary to-accent",
  "from-secondary to-primary",
  "from-accent to-secondary",
];

function MemberCard({ member: m, index }: { member: Member; index: number }) {
  return (
    <article className="group">
      <div className="relative aspect-4/5 overflow-hidden rounded-[calc(var(--radius)*2.2)] bg-muted">
        {m.image ? (
          <Image
            src={src(m.image)}
            alt={`${m.name}, ${m.role}`}
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 80vw"
            className="object-cover grayscale-30 transition duration-700 ease-out group-hover:scale-[1.05] group-hover:grayscale-0"
          />
        ) : (
          <div
            aria-hidden="true"
            className={cn(
              "grid size-full place-items-center bg-linear-to-br text-white",
              MONOGRAMS[index % MONOGRAMS.length],
            )}
          >
            <span className="text-4xl font-semibold tracking-tight opacity-90 sm:text-6xl">
              {initials(m.name)}
            </span>
          </div>
        )}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/75 via-black/25 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-3.5 text-white sm:p-5">
          <h3 className="text-base font-semibold tracking-tight sm:text-xl">
            {m.name}
          </h3>
          {m.role && (
            <p className="mt-0.5 text-xs font-medium text-white/80 sm:text-sm">
              {m.role}
            </p>
          )}
        </div>
      </div>
      {(m.bio || m.links.length > 0) && (
        <div className="px-1 pt-4">
          {m.bio && (
            <p className="text-sm leading-relaxed text-pretty text-foreground/65 sm:text-[15px]">
              {m.bio}
            </p>
          )}
          {m.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {m.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-foreground/12 px-3 text-sm font-medium transition hover:border-foreground/30"
                >
                  {l.label} <ArrowUpRight className="size-3.5" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
