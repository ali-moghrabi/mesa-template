import Image from "next/image";
import Link from "next/link";
import { Icon } from "./Icon";
import { Section } from "@/components/common/Section";
import type { AboutVariantProps } from "./schema";
import { cn } from "@/lib/utils";

export function AboutSplit({ id, props, content }: AboutVariantProps) {
  const imageEnd = props.imagePosition === "end";
  const [lead, ...rest] = content.body;

  return (
    <Section id={id}>
      <div className="flex items-center justify-center gap-12 max-[900px]:flex-col min-[900px]:gap-20">
        <div
          className={cn(
            "group relative mx-auto w-full max-w-130 overflow-hidden rounded-[calc(var(--radius)*2)] bg-muted",
            "aspect-16/10",
            "min-[640px]:aspect-video",
            "min-[900px]:mx-0 min-[900px]:max-w-115 min-[900px]:aspect-4/5",
            imageEnd
              ? "min-[900px]:order-2 min-[900px]:ml-auto min-[900px]:rounded-l-[calc(var(--radius)*3)] min-[900px]:rounded-r-none"
              : "min-[900px]:rounded-r-[calc(var(--radius)*3)]",
          )}
        >
          <Image
            src={`/${content.image}`}
            alt="about image"
            sizes="(min-width: 900px) 460px, (min-width: 640px) 80vw, 92vw"
            className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            fill
          />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/15 via-transparent to-transparent" />
        </div>

        <div className="max-w-136">
          <h2 className="text-[clamp(2.2rem,4.6vw,3.75rem)] leading-[1.03] font-medium tracking-[-0.04em] text-balance">
            {content.title}
          </h2>

          <div className="mt-6 space-y-5">
            <p className="text-xl leading-[1.55] text-pretty">{lead}</p>
            {rest.map((paragraph, i) => (
              <p
                key={i}
                className="leading-[1.7] text-pretty text-foreground/75"
              >
                {paragraph}
              </p>
            ))}
          </div>

          {content.highlights && content.highlights.length > 0 && (
            <ul className="mt-10 divide-y divide-border border-y border-border">
              {content.highlights.map((h, i) => (
                <li key={`${h.title}-${i}`} className="flex gap-4 py-4">
                  <Icon
                    name={h.icon as keyof typeof Icon}
                    className="mt-0.5 size-5 shrink-0 text-primary"
                  />
                  <div>
                    <h3 className="font-semibold">{h.title}</h3>
                    <p className="text-foreground/70">{h.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {props.showCta && content.cta && (
            <Link
              href={content.cta.href}
              className="mt-10 inline-flex min-h-12 items-center rounded-[calc(var(--radius)*1.1)] border border-foreground/25 px-6 font-semibold transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {content.cta.label}
            </Link>
          )}
        </div>
      </div>
    </Section>
  );
}
