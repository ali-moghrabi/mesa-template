import type { Metadata } from "next";
import { pageMetadata } from "@/config/seo";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { PageHeader } from "@/components/common/PageHeader";
import Contact from "@/components/shared/Contact";
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
  title: z.string().catch("Contact"),
  subtitle: z.string().optional().catch(undefined),
  image: z.string().optional().catch(undefined),
});

function contactPage() {
  const config = getConfig();
  const raw = (config as unknown as { pages?: Record<string, unknown> }).pages
    ?.contact;
  const parsed = pageSchema.safeParse(raw ?? {});
  const settings = parsed.success ? parsed.data : pageSchema.parse({});
  const sections = settings.sections.flatMap((s) => {
    const one = sectionSchema.safeParse(s);
    return one.success && one.data.enabled ? [{ ...one.data, raw: s }] : [];
  });
  return { config, settings, sections };
}

export function generateMetadata(): Metadata {
  const { config, settings } = contactPage();
  return pageMetadata({
    title: settings.seo?.title ?? `Contact`,
    description:
      settings.seo?.description ??
      `Find ${config.brand.name}, call us or send a message.`,
    path: "/contact",
  });
}

export default function ContactPage() {
  const { settings, sections } = contactPage();
  if (!settings.enabled) notFound();
  const hasContact = sections.some((s) => s.type === "contact");

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
                eyebrow="Contact"
                title={top.title}
                subtitle={top.subtitle}
                image={image}
              />
            );
          }
          case "contact":
            return <Contact key={key} section={s.raw} />;
          case "hoursLocation":
            return <Hours key={key} section={s.raw} />;
          default:
            return null;
        }
      })}
      {!hasContact && <Contact section={{ variant: "split" }} />}
    </main>
  );
}
