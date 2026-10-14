import Link from "next/link";
import { ArrowRight, MessageCircleQuestion, Plus } from "lucide-react";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { cn } from "@/lib/utils";

export const FAQ_VARIANTS = ["accordion", "columns"] as const;

const sectionSchema = z.object({
  id: z.string().catch("faq"),
  variant: z.enum(FAQ_VARIANTS).catch("accordion"),
  enabled: z.boolean().catch(true),
  props: z
    .object({
      eyebrow: z.string().catch("FAQ"),
      title: z.string().catch("Good to know"),
      subtitle: z.string().optional().catch(undefined),
    })
    .catch({ eyebrow: "FAQ", title: "Good to know" }),
});

const faqsSchema = z.array(
  z.object({ question: z.string().min(1), answer: z.string().min(1) }),
);

export default function Faq({ section }: { section?: unknown }) {
  const config = sectionSchema.parse(section ?? {});
  if (!config.enabled) return null;

  const site = getConfig() as unknown as {
    content?: { faqs?: unknown };
    pages?: { contact?: { enabled?: boolean } };
    business?: { phone?: string };
  };
  const parsed = faqsSchema.safeParse(site.content?.faqs);
  if (!parsed.success || parsed.data.length === 0) return null;
  const faqs = parsed.data;
  const contactOn = site.pages?.contact?.enabled === true;
  const { eyebrow, title, subtitle } = config.props;

  const structured = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const ask = (
    <div className="rounded-[calc(var(--radius)*2)] bg-foreground p-6 text-background">
      <span className="grid size-11 place-items-center rounded-xl bg-background/12">
        <MessageCircleQuestion className="size-5" />
      </span>
      <p className="mt-4 text-lg font-semibold">Still curious?</p>
      <p className="mt-1 text-sm text-pretty text-background/70">
        {contactOn
          ? "Send us a message, we're happy to help."
          : site.business?.phone
            ? `Call us at ${site.business.phone}, we're happy to help.`
            : "Ask us at your next visit."}
      </p>
      {contactOn && (
        <Link
          href="/contact"
          className="group mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-background px-4 text-sm font-semibold text-foreground"
        >
          Contact us{" "}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );

  const heading = (center: boolean) => (
    <div className={cn(center && "mx-auto max-w-2xl text-center")}>
      <p
        className={cn(
          "inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase",
          center && "justify-center",
        )}
      >
        <span aria-hidden="true" className="h-px w-8 bg-primary/60" />
        {eyebrow}
        {center && (
          <span aria-hidden="true" className="h-px w-8 bg-primary/60" />
        )}
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
      className="bg-background px-(--pad) py-20 text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-28"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />

      {config.variant === "columns" ? (
        <div className="mx-auto max-w-6xl">
          {heading(true)}
          <dl className="mt-12 grid gap-4 md:grid-cols-2">
            {faqs.map((f, i) => (
              <div
                key={f.question}
                className="rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-card p-6 transition-colors hover:border-foreground/20 sm:p-7"
              >
                <dt className="flex gap-4 text-lg font-semibold tracking-tight">
                  <span className="mt-0.5 shrink-0 text-sm font-semibold text-primary tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {f.question}
                </dt>
                <dd className="mt-3 pl-9 leading-relaxed text-pretty text-foreground/65">
                  {f.answer}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mx-auto mt-10 max-w-md text-center">{ask}</div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          <div className="lg:sticky lg:top-[calc(var(--nav-height,4.5rem)+2rem)] lg:self-start">
            {heading(false)}
            <div className="mt-8 hidden lg:block">{ask}</div>
          </div>
          <div>
            <div className="divide-y divide-foreground/10 border-y border-foreground/10">
              {faqs.map((f, i) => (
                <details
                  key={f.question}
                  name={`${config.id}-questions`}
                  className="group [interpolate-size:allow-keywords] details-content:h-0 details-content:overflow-hidden details-content:transition-[height,content-visibility] details-content:transition-discrete details-content:duration-300 [&[open]::details-content]:h-auto"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-5 py-6 text-left outline-none focus-visible:ring-3 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
                    <span className="w-6 shrink-0 text-sm font-semibold text-foreground/35 tabular-nums transition-colors group-open:text-primary">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-lg font-semibold tracking-tight sm:text-xl">
                      {f.question}
                    </span>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full border border-foreground/15 transition-all duration-300 group-open:rotate-45 group-open:border-primary group-open:bg-primary group-open:text-white">
                      <Plus className="size-4" />
                    </span>
                  </summary>
                  <p className="pr-14 pb-7 pl-11 text-[17px] leading-relaxed text-pretty text-foreground/65">
                    {f.answer}
                  </p>
                </details>
              ))}
            </div>
            <div className="mt-8 lg:hidden">{ask}</div>
          </div>
        </div>
      )}
    </section>
  );
}
