import type { Metadata } from "next";
import { pageMetadata } from "@/config/seo";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { reservationsEnabled } from "@/lib/reservations-server";
import { readPrefill } from "@/lib/reservations";
import { PageHeader } from "@/components/common/PageHeader";
import ReservationForm from "@/components/forms/ReservationForm";
import ReservationCta from "@/components/common/ReservationCta";
import Hours from "@/components/home/Hours";

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
  title: z.string().catch("Reserve a table"),
  subtitle: z.string().optional().catch(undefined),
  image: z.string().optional().catch(undefined),
});

function reservationsPage() {
  const config = getConfig();
  const raw = (config as unknown as { pages?: Record<string, unknown> }).pages
    ?.reservations;
  const parsed = pageSchema.safeParse(raw ?? {});
  const settings = parsed.success ? parsed.data : pageSchema.parse({});
  const sections = settings.sections.flatMap((s) => {
    const one = sectionSchema.safeParse(s);
    return one.success && one.data.enabled ? [{ ...one.data, raw: s }] : [];
  });
  return { config, settings, sections };
}

export function generateMetadata(): Metadata {
  const { config, settings } = reservationsPage();
  return pageMetadata({
    title: settings.seo?.title ?? `Reserve a table`,
    description:
      settings.seo?.description ??
      `Book a table at ${config.brand.name} online.`,
    path: "/reservations",
  });
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReservationsPage({ searchParams }: PageProps) {
  if (!reservationsEnabled()) notFound();
  const { sections } = reservationsPage();
  const prefill = readPrefill(await searchParams);
  const hasForm = sections.some((s) => s.type === "reservationForm");

  return (
    <main className="min-h-svh bg-background text-foreground">
      {sections.map((s, i) => {
        const key = s.id ?? `${s.type}-${i}`;
        switch (s.type) {
          case "pageHeader": {
            const top = headerProps.parse(s.props ?? {});
            const image = top.image
              ? /^(https?:)?\//.test(top.image)
                ? top.image
                : `/${top.image}`
              : undefined;
            return (
              <PageHeader
                key={key}
                variant={s.variant === "image" && image ? "image" : "simple"}
                eyebrow="Reservations"
                title={top.title}
                subtitle={top.subtitle}
                image={image}
              />
            );
          }
          case "reservationForm":
            return (
              <ReservationForm key={key} section={s.raw} prefill={prefill} />
            );
          case "reservationCta":
            return <ReservationCta key={key} section={s.raw} />;
          case "hoursLocation":
            return <Hours key={key} section={s.raw} />;
          default:
            return null;
        }
      })}
      {!hasForm && (
        <ReservationForm section={{ variant: "inline" }} prefill={prefill} />
      )}
    </main>
  );
}
