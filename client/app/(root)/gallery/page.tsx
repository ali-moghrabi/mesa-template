import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RotateCw, ImageOff } from "lucide-react";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { getPublicGallery } from "@/lib/gallery-server";
import { PageHeader } from "@/components/common/PageHeader";
import { Gallery } from "@/components/common/Gallery";

const sectionSchema = z.object({
  type: z.string(),
  variant: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});
const pageSchema = z.object({
  enabled: z.boolean().default(true),
  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  sections: z.array(sectionSchema).default([]),
});
const headerProps = z.object({
  title: z.string().catch("Gallery"),
  subtitle: z.string().optional().catch(undefined),
  image: z.string().optional().catch(undefined),
});
const galleryProps = z.object({
  lightbox: z.boolean().catch(true),
  showFilters: z.boolean().catch(true),
});

function galleryPage() {
  const config = getConfig();
  const raw = (config as unknown as { pages?: Record<string, unknown> }).pages
    ?.gallery;
  const parsed = pageSchema.safeParse(raw ?? {});
  const settings = parsed.success ? parsed.data : pageSchema.parse({});
  const header = settings.sections.find((s) => s.type === "pageHeader");
  const gallery = settings.sections.find((s) => s.type === "gallery");
  return { config, settings, header, gallery };
}

export function generateMetadata(): Metadata {
  const { config, settings } = galleryPage();
  return {
    title: settings.seo?.title ?? `Gallery | ${config.brand.name}`,
    description:
      settings.seo?.description ??
      `Photos of the food, the room and the people at ${config.brand.name}.`,
  };
}

export default async function GalleryPage() {
  const { settings, header, gallery } = galleryPage();
  if (!settings.enabled) notFound();

  const result = await getPublicGallery();
  const photos = result.ok ? result.photos : [];

  const top = headerProps.parse(header?.props ?? {});

  const image = top.image
    ? /^(https?:)?\//.test(top.image)
      ? top.image
      : `/${top.image}`
    : undefined;
  const options = galleryProps.parse(gallery?.props ?? {});
  const albums = new Set(photos.map((p) => p.album)).size;

  return (
    <main className="min-h-svh bg-background text-foreground">
      <PageHeader
        variant={header?.variant === "image" && image ? "image" : "simple"}
        eyebrow="Gallery"
        title={top.title}
        subtitle={top.subtitle}
        image={image}
        stats={
          photos.length > 0
            ? [
                {
                  label: photos.length === 1 ? "Photo" : "Photos",
                  value: photos.length,
                },
                { label: albums === 1 ? "Album" : "Albums", value: albums },
              ]
            : []
        }
      />

      {result.ok ? (
        <Gallery
          photos={photos}
          variant={gallery?.variant === "grid" ? "grid" : "masonry"}
          lightbox={options.lightbox}
          showFilters={options.showFilters}
        />
      ) : (
        <div className="px-(--pad) pt-12 pb-28 [--pad:clamp(1.1rem,4vw,3.5rem)]">
          <div className="mx-auto flex max-w-xl flex-col items-center rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-muted px-6 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-background text-foreground/60 shadow-sm">
              <ImageOff className="size-6" />
            </span>
            <p className="mt-5 text-xl font-medium">
              The photos are taking a moment
            </p>
            <p className="mt-1.5 max-w-sm text-pretty text-foreground/65">
              {result.message} Please try again in a minute.
            </p>
            <Link
              href="/gallery"
              prefetch={false}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 font-semibold text-background transition-opacity hover:opacity-90"
            >
              <RotateCw className="size-4" /> Try again
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
