import type { Metadata } from "next";
import { pageMetadata } from "@/config/seo";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { PageHeader } from "@/components/common/PageHeader";
import About from "@/components/sections/About";
import Team from "@/components/sections/Team";
import Faq from "@/components/sections/Faq";
import StatsPreview from "@/components/home/StatsPreview";
import Hours from "@/components/home/Hours";
import ReservationCta from "@/components/common/ReservationCta";

const sectionSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  variant: z.string().optional(),
  enabled: z.boolean().default(true),
  props: z.record(z.string(), z.unknown()).optional(),
});
const pageSchema = z.object({
  enabled: z.boolean().default(false),
  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  sections: z.array(z.unknown()).default([]),
});
const headerProps = z.object({
  title: z.string().catch("Our story"),
  subtitle: z.string().optional().catch(undefined),
  image: z.string().optional().catch(undefined),
  eyebrow: z.string().catch("About us"),
  showStats: z.boolean().catch(true),
});
const statsSchema = z
  .array(z.object({ value: z.string(), label: z.string() }))
  .catch([]);

function aboutPage() {
  const config = getConfig();
  const raw = (config as unknown as { pages?: Record<string, unknown> }).pages
    ?.about;
  const parsed = pageSchema.safeParse(raw ?? {});
  const settings = parsed.success ? parsed.data : pageSchema.parse({});
  const sections = settings.sections.flatMap((s) => {
    const one = sectionSchema.safeParse(s);
    return one.success && one.data.enabled ? [{ ...one.data, raw: s }] : [];
  });
  return { config, settings, sections };
}

export function generateMetadata(): Metadata {
  const { config, settings } = aboutPage();
  return pageMetadata({
    title: settings.seo?.title ?? `Our story`,
    description:
      settings.seo?.description ??
      `The people and the story behind ${config.brand.name}.`,
    path: "/about",
  });
}

export default function AboutPage() {
  const { config, settings, sections } = aboutPage();
  if (!settings.enabled) notFound();
  const allStats = statsSchema.parse(
    (config as unknown as { content?: { stats?: unknown } }).content?.stats,
  );
  const stats = allStats.slice(0, allStats.length >= 4 ? 4 : 2);

  return (
    <main className="min-h-svh bg-background text-foreground">
      {sections.map((s, i) => {
        const key = s.id ?? `${s.type}-${i}`;
        switch (s.type) {
          case "pageHeader": {
            const top = headerProps.parse(s.props ?? {});
            const image = top.image
              ? /^(https?:\/\/|\/)/.test(top.image)
                ? top.image
                : `/${top.image}`
              : undefined;
            return (
              <PageHeader
                key={key}
                variant={s.variant === "image" && image ? "image" : "simple"}
                eyebrow={top.eyebrow}
                title={top.title}
                subtitle={top.subtitle}
                image={image}
                stats={top.showStats ? stats : []}
              />
            );
          }
          case "about":
            return <About key={key} section={s.raw} pathname="/about" />;
          case "team":
            return <Team key={key} section={s.raw} />;
          case "faq":
            return <Faq key={key} section={s.raw} />;
          case "stats":
            return <StatsPreview key={key} section={s.raw} />;
          case "hoursLocation":
            return <Hours key={key} section={s.raw} />;
          case "reservationCta":
            return <ReservationCta key={key} section={s.raw} />;
          default:
            return null;
        }
      })}
    </main>
  );
}
