import Image from "next/image";
import type { Section as SectionConfig } from "@/config/schema";
import { Section } from "@/components/common/Section";
import { NewsletterForm } from "../forms/NewsletterForm";
import { newsletterSchema } from "./schema";

type Props = {
  section: SectionConfig;
};

export function Newsletter({ section }: Props) {
  const props = newsletterSchema.parse(section.props);
  const split = section.variant === "split" && props.image;

  if (split) {
    return (
      <Section id={section.id}>
        <div className="grid overflow-hidden rounded-[calc(var(--radius)*3)] bg-primary text-primary-foreground min-[800px]:grid-cols-2">
          <div className="relative aspect-video min-[800px]:aspect-auto min-[800px]:min-h-104">
            <Image
              src={`/${props.image}`}
              alt=""
              fill
              sizes="(min-width: 800px) 50vw, 100vw"
              className="object-cover"
            />
          </div>

          <div className="flex flex-col justify-center gap-3 p-8 min-[800px]:p-12 min-[1100px]:p-16">
            <h2 className="text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] font-medium tracking-[-0.04em] text-balance text-white">
              {props.title}
            </h2>
            {props.subtitle && (
              <p className="max-w-md text-lg text-pretty text-neutral-300">
                {props.subtitle}
              </p>
            )}
            <NewsletterForm
              tone="onPrimary"
              placeholder={props.placeholder}
              buttonLabel={props.buttonLabel}
              className="mt-2 max-w-md"
            />
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section
      id={section.id}
      className="border-t border-border py-16 min-[900px]:py-20"
    >
      <div className="grid items-center gap-8 min-[900px]:grid-cols-[1.1fr_1fr] min-[900px]:gap-20">
        <div>
          <h2 className="text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.05] font-medium tracking-[-0.04em] text-balance">
            {props.title}
          </h2>

          {props.subtitle && (
            <p className="mt-3 max-w-md text-lg text-pretty text-foreground/75">
              {props.subtitle}
            </p>
          )}
        </div>

        <NewsletterForm
          tone="light"
          placeholder={props.placeholder}
          buttonLabel={props.buttonLabel}
        />
      </div>
    </Section>
  );
}
