import type { Metadata } from "next";
import { pageMetadata } from "@/config/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, Mail, Printer, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { PageHeader } from "@/components/common/PageHeader";

const docSchema = z.object({
  title: z.string().min(1),
  updated: z.string().optional().catch(undefined),
  body: z.union([z.string(), z.array(z.string())]),
});

type Block =
  | { kind: "h2"; text: string; id: string; n: number }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

function legalDocs() {
  const config = getConfig() as unknown as {
    brand: { name: string };
    legal?: Record<string, unknown>;
    seo?: { siteUrl?: string };
    business?: {
      legalName?: string;
      email?: string;
      phone?: string;
      address?: { street?: string; city?: string; country?: string } | string;
    };
  };
  const docs = Object.entries(config.legal ?? {}).flatMap(([slug, value]) => {
    const parsed = docSchema.safeParse(value);
    return parsed.success && /^[a-z0-9-]+$/.test(slug)
      ? [{ slug, ...parsed.data }]
      : [];
  });
  const b = config.business ?? {};
  const address =
    typeof b.address === "string"
      ? b.address
      : [b.address?.street, b.address?.city, b.address?.country]
          .filter(Boolean)
          .join(", ");
  const tokens: Record<string, string> = {
    brand: config.brand.name,
    legalName: b.legalName || config.brand.name,
    email: b.email ?? "",
    phone: b.phone ?? "",
    address,
    website:
      (config.seo?.siteUrl ?? "")
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "") || "our website",
    country:
      (typeof b.address === "object" && b.address?.country) ||
      "the country where we operate",
  };
  return { config, docs, tokens };
}

const fill = (text: string, tokens: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => tokens[key] ?? match);
const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/^\d+[.)]\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function parse(
  body: string | string[],
  tokens: Record<string, string>,
): Block[] {
  const raw = (Array.isArray(body) ? body : body.split(/\n\s*\n/))
    .map((b) => fill(b.trim(), tokens))
    .filter(Boolean);
  const blocks: Block[] = [];
  let n = 0;
  for (const chunk of raw) {
    const lines = chunk.split("\n").map((l) => l.trim());
    if (lines.every((l) => l.startsWith("- "))) {
      const items = lines.map((l) => l.slice(2).trim());
      const last = blocks.at(-1);
      if (last?.kind === "ul") last.items.push(...items);
      else blocks.push({ kind: "ul", items });
    } else if (chunk.startsWith("## ")) {
      const text = chunk.slice(3).trim();
      n += 1;
      blocks.push({ kind: "h2", text, id: slugify(text) || `section-${n}`, n });
    } else if (chunk.startsWith("### ")) {
      blocks.push({ kind: "h3", text: chunk.slice(4).trim() });
    } else {
      blocks.push({ kind: "p", text: lines.join(" ") });
    }
  }
  return blocks;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = /^\*\*([^*]+)\*\*$/.exec(part);
        if (bold)
          return (
            <strong key={i} className="font-semibold text-foreground">
              {bold[1]}
            </strong>
          );
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
        if (link) {
          const href = link[2];
          const safe = /^(\/|https?:\/\/|mailto:|tel:|#)/.test(href);
          if (!safe) return link[1];
          return href.startsWith("/") || href.startsWith("#") ? (
            <Link
              key={i}
              href={href}
              className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
            >
              {link[1]}
            </Link>
          ) : (
            <a
              key={i}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
            >
              {link[1]}
            </a>
          );
        }
        return part;
      })}
    </>
  );
}

const formatDate = (iso?: string) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));
};

type Props = { params: Promise<{ doc: string }> };

export function generateStaticParams() {
  return legalDocs().docs.map((d) => ({ doc: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;
  const { config, docs } = legalDocs();
  const found = docs.find((d) => d.slug === doc);
  if (!found) return { title: `Not found | ${config.brand.name}` };
  return pageMetadata({
    title: found.title,
    description: `${found.title} of ${config.brand.name}.`,
    path: `/legal/${found.slug}`,
  });
}

export default async function LegalPage({ params }: Props) {
  const { doc } = await params;
  const { config, docs, tokens } = legalDocs();
  const found = docs.find((d) => d.slug === doc);
  if (!found) notFound();

  const blocks = parse(found.body, tokens);
  const sections = blocks.filter(
    (b): b is Extract<Block, { kind: "h2" }> => b.kind === "h2",
  );
  const updated = formatDate(found.updated);
  const others = docs.filter((d) => d.slug !== found.slug);
  const words = blocks.reduce(
    (n, b) =>
      n + (b.kind === "ul" ? b.items.join(" ") : b.text).split(/\s+/).length,
    0,
  );
  const minutes = Math.max(1, Math.round(words / 220));

  return (
    <main className="min-h-svh bg-background text-foreground">
      <PageHeader
        variant="simple"
        eyebrow="Legal"
        title={found.title}
        subtitle={updated ? `Last updated ${updated}` : undefined}
      />

      <div className="px-(--pad) py-12 [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
          <aside className="lg:sticky lg:top-[calc(var(--nav-height,4.5rem)+2rem)] lg:self-start print:hidden">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/55">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="size-4" /> {minutes} min read
              </span>
            </div>
            {sections.length > 1 && (
              <nav aria-label="On this page" className="mt-6 hidden lg:block">
                <p className="text-xs font-semibold tracking-[0.18em] text-foreground/45 uppercase">
                  On this page
                </p>
                <ol className="mt-3 space-y-0.5 border-l border-foreground/10">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="-ml-px flex gap-2.5 border-l-2 border-transparent py-1.5 pl-4 text-sm text-foreground/60 transition-colors hover:border-primary hover:text-foreground"
                      >
                        <span className="w-5 shrink-0 text-foreground/35 tabular-nums">
                          {String(s.n).padStart(2, "0")}
                        </span>
                        <span>{s.text}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
          </aside>

          <article className="min-w-0 max-w-3xl">
            {blocks.map((b, i) => {
              switch (b.kind) {
                case "h2":
                  return (
                    <h2
                      key={i}
                      id={b.id}
                      className="mt-14 flex scroll-mt-28 items-baseline gap-3 border-t border-foreground/10 pt-10 text-2xl font-semibold tracking-tight first:mt-0 first:border-0 first:pt-0 sm:text-[1.7rem]"
                    >
                      <span className="text-base font-semibold text-primary tabular-nums">
                        {String(b.n).padStart(2, "0")}
                      </span>
                      {b.text}
                    </h2>
                  );
                case "h3":
                  return (
                    <h3
                      key={i}
                      className="mt-8 text-lg font-semibold tracking-tight"
                    >
                      <Inline text={b.text} />
                    </h3>
                  );
                case "ul":
                  return (
                    <ul key={i} className="mt-4 space-y-2.5">
                      {b.items.map((item, j) => (
                        <li
                          key={j}
                          className="flex gap-3 text-[17px] leading-relaxed text-foreground/75"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-primary"
                          />
                          <span>
                            <Inline text={item} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  );
                default:
                  return (
                    <p
                      key={i}
                      className={
                        i === 0
                          ? "text-xl leading-relaxed text-pretty text-foreground/85"
                          : "mt-4 text-[17px] leading-relaxed text-pretty text-foreground/75"
                      }
                    >
                      <Inline text={b.text} />
                    </p>
                  );
              }
            })}

            <div className="mt-16 grid gap-4 sm:grid-cols-2 print:hidden">
              <div className="rounded-[calc(var(--radius)*2)] bg-foreground p-6 text-background">
                <span className="grid size-10 place-items-center rounded-xl bg-background/12">
                  <ShieldCheck className="size-5" />
                </span>
                <p className="mt-4 font-semibold">Questions about this page?</p>
                <p className="mt-1 text-sm text-background/70">
                  We&apos;re happy to explain anything here.
                </p>
                {tokens.email && (
                  <a
                    href={`mailto:${tokens.email}`}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
                  >
                    <Mail className="size-4" /> {tokens.email}
                  </a>
                )}
              </div>
              <div className="flex flex-col rounded-[calc(var(--radius)*2)] border border-foreground/10 p-6">
                {others.length > 0 && (
                  <>
                    <p className="text-sm font-semibold text-foreground/55">
                      Also read
                    </p>
                    <ul className="mt-3 space-y-2">
                      {others.map((o) => (
                        <li key={o.slug}>
                          <Link
                            href={`/legal/${o.slug}`}
                            className="group inline-flex items-center gap-2 font-semibold hover:text-primary"
                          >
                            {o.title}{" "}
                            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-auto pt-6 text-sm text-foreground/50">
                  {config.brand.name}
                  {tokens.legalName !== config.brand.name &&
                    ` is run by ${tokens.legalName}`}
                  {tokens.address && `, ${tokens.address}`}.
                </p>
              </div>
            </div>
            <p className="mt-6 hidden items-center gap-1.5 text-xs text-foreground/40 sm:flex print:hidden">
              <Printer className="size-3.5" /> Prints cleanly from your browser
              (Ctrl/Cmd + P).
            </p>
          </article>
        </div>
      </div>
    </main>
  );
}
