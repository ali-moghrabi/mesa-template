import Image from "next/image";
import Link from "next/link";
import { Icon } from "./Icon";
import { Section } from "@/components/common/Section";
import type { AboutVariantProps } from "./schema";

export function AboutStacked({ id, props, content }: AboutVariantProps) {
  const [lead, ...rest] = content.body;

  return (
    <Section id={id}>
      <div className="mx-auto flex max-w-4xl flex-col gap-10 text-center min-[900px]:gap-14">
        <header>
          <h2 className="mx-auto max-w-[16ch] text-[clamp(2.4rem,6vw,4.75rem)] leading-none font-medium tracking-[-0.045em] text-balance">
            {content.title}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-xl leading-[1.55] text-pretty">
            {lead}
          </p>
        </header>

        <div className="relative mx-auto aspect-4/3 max-h-112 w-full overflow-hidden rounded-[calc(var(--radius)*2.4)] min-[700px]:aspect-3/2">
          <Image
            src={`/${content.image}`}
            alt="about image"
            fill
            sizes="(min-width: 900px) 56rem, 100vw"
            className="object-cover"
          />
        </div>

        {rest.length > 0 && (
          <div className="mx-auto max-w-xl space-y-5">
            {rest.map((paragraph, i) => (
              <p
                key={i}
                className="leading-[1.7] text-pretty text-foreground/75"
              >
                {paragraph}
              </p>
            ))}
          </div>
        )}

        {content.highlights && content.highlights.length > 0 && (
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-8 border-t border-border pt-10">
            {content.highlights.map((h, i) => (
              <li
                key={`${h.title}-${i}`}
                className="flex flex-col items-center gap-3"
              >
                <Icon
                  name={h.icon as keyof typeof Icon}
                  className="size-6 text-primary"
                />
                <h3 className="font-semibold">{h.title}</h3>
                <p className="-mt-1 text-foreground/70">{h.text}</p>
              </li>
            ))}
          </ul>
        )}

        {props.showCta && content.cta && (
          <Link
            href={content.cta.href}
            className="mx-auto inline-flex min-h-12 items-center rounded-[calc(var(--radius)*1.1)] border border-foreground/25 px-6 font-semibold transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {content.cta.label}
          </Link>
        )}
      </div>
    </Section>
  );
}
