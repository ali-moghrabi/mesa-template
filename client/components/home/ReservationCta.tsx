import Image from "next/image";
import Link from "next/link";
import type { Section as SectionConfig } from "@/config/schema";
import { Section } from "@/components/common/Section";
import { reservationCtaSchema } from "./schema";

type Props = {
  section: SectionConfig;
};

export function ReservationCta({ section }: Props) {
  const props = reservationCtaSchema.parse(section.props);

  return (
    <Section id={section.id}>
      <div className="relative isolate overflow-hidden rounded-[calc(var(--radius)*3)] bg-[#1b120c] text-white">
        <Image
          src={`/${props.image}`}
          alt=""
          fill
          sizes="100vw"
          className="-z-10 object-cover"
          style={{ objectPosition: props.imagePosition }}
        />
        <div
          className="absolute inset-0 -z-10"
          style={{ backgroundColor: `rgba(0,0,0,${props.overlay})` }}
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(0,0,0,.55),transparent_60%)]" />

        <div className="grid min-h-104 content-end gap-8 p-6 min-[600px]:p-10 min-[900px]:min-h-136 min-[900px]:grid-cols-[1.25fr_1fr] min-[900px]:items-end min-[900px]:gap-16 min-[900px]:p-14">
          <h2 className="text-[clamp(2.4rem,6.5vw,5.5rem)] leading-[0.98] font-medium tracking-[-0.045em] text-balance">
            {props.title}
          </h2>

          <div className="max-w-md">
            {props.subtitle && (
              <p className="text-lg leading-normal text-pretty text-white/90">
                {props.subtitle}
              </p>
            )}
            <Link
              href={props.cta.href}
              className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-[calc(var(--radius)*1.1)] bg-primary px-8 font-semibold text-primary-foreground transition hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent min-[600px]:w-auto"
            >
              {props.cta.label}
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
