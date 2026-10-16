import type { Metadata } from "next";
import { pageMetadata } from "@/config/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RotateCw, UtensilsCrossed } from "lucide-react";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { getOpeningHours } from "@/lib/opening-hours-server";
import { getPublicMenu } from "@/lib/menu/public-menu";
import { MenuPageHeader } from "@/components/menu/MenuPageHeader";
import { FullMenu } from "@/components/menu/FullMenu";
import {
  WhatsAppOrder,
  type WhatsAppOrderSettings,
} from "@/components/whatsapp/WhatsAppOrder";
import { whatsappNumber } from "@/lib/whatsapp";
import QueryWrapper from "@/components/providers/query-wrapper";

const sectionSchema = z.object({
  type: z.string(),
  variant: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});
const menuPageSchema = z.object({
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
  title: z.string().catch("Our menu"),
  subtitle: z.string().optional().catch(undefined),
  image: z.string().optional().catch(undefined),
});
const menuProps = z.object({
  showImages: z.boolean().catch(true),
  showSearch: z.boolean().catch(true),
  showFilters: z.boolean().catch(true),
  showAllergens: z.boolean().catch(true),
});

function menuPage() {
  const config = getConfig();
  const raw = (config as unknown as { pages?: Record<string, unknown> }).pages
    ?.menu;
  const page = menuPageSchema.safeParse(raw ?? {});
  const settings = page.success ? page.data : menuPageSchema.parse({});
  const header = settings.sections.find((s) => s.type === "pageHeader");
  const menu = settings.sections.find((s) => s.type === "fullMenu");
  return { config, settings, header, menu };
}

export function generateMetadata(): Metadata {
  const { config, settings } = menuPage();
  return pageMetadata({
    title: settings.seo?.title ?? `Menu`,
    description:
      settings.seo?.description ??
      `The full menu at ${config.brand.name}: dishes, prices and dietary information.`,
    path: "/menu",
  });
}

export default async function MenuPage() {
  const { config, settings, header, menu } = menuPage();
  if (!settings.enabled) notFound();

  const [result, hours] = await Promise.all([
    getPublicMenu(),
    getOpeningHours(),
  ]);

  const top = headerProps.parse(header?.props ?? {});
  const image = top.image
    ? /^(https?:)?\//.test(top.image)
      ? top.image
      : `/${top.image}`
    : undefined;
  const options = menuProps.parse(menu?.props ?? {});
  const variant =
    menu?.variant === "list" || menu?.variant === "grid"
      ? menu.variant
      : "tabs";

  const pricing = config.menu.pricing;
  const service = pricing?.serviceChargeRate
    ? Math.round(
        pricing.serviceChargeRate <= 1
          ? pricing.serviceChargeRate * 100
          : pricing.serviceChargeRate,
      )
    : 0;
  const pricingNote =
    pricing?.note ||
    (pricing
      ? [
          pricing.taxIncluded ? "All prices include VAT" : "Prices exclude VAT",
          service ? `${service}% service charge added to the bill` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined);

  const categories = result.ok ? result.menu.categories : [];

  const online = config.features?.onlineOrdering === true;
  const waNumber = config.features?.whatsappOrdering
    ? whatsappNumber(config.business.whatsapp?.number)
    : null;
  const whatsapp: WhatsAppOrderSettings | null = waNumber
    ? {
        number: waNumber,
        brandName: config.brand.name,
        currency: config.menu.currency,
        online,
        delivery: config.features.delivery === true,
        pickup: config.features.pickup === true,
      }
    : null;

  return (
    <main className="min-h-svh bg-background text-foreground">
      <MenuPageHeader
        variant={header?.variant === "image" && image ? "image" : "simple"}
        title={top.title}
        subtitle={top.subtitle}
        image={image}
        categories={categories}
        hours={hours}
      />

      {result.ok ? (
        whatsapp ? (
          <QueryWrapper>
            <WhatsAppOrder settings={whatsapp}>
              <FullMenu
                categories={categories}
                variant={variant}
                options={options}
                currency={config.menu.currency}
                ordering
                soldOut={
                  config.menu.unavailableItems === "hide"
                    ? "hide"
                    : "show-sold-out"
                }
                pricingNote={pricingNote}
              />
            </WhatsAppOrder>
          </QueryWrapper>
        ) : (
          <QueryWrapper>
            <FullMenu
              categories={categories}
              variant={variant}
              options={options}
              currency={config.menu.currency}
              ordering={online}
              soldOut={
                config.menu.unavailableItems === "hide"
                  ? "hide"
                  : "show-sold-out"
              }
              pricingNote={pricingNote}
            />
          </QueryWrapper>
        )
      ) : (
        <div className="px-(--pad) pt-10 pb-28 [--pad:clamp(1.1rem,4vw,3.5rem)]">
          <div className="mx-auto flex max-w-xl flex-col items-center rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-muted px-6 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-background text-foreground/60 shadow-sm">
              <UtensilsCrossed className="size-6" />
            </span>
            <p className="mt-5 text-xl font-medium">
              The menu is taking a moment
            </p>
            <p className="mt-1.5 max-w-sm text-pretty text-foreground/65">
              {result.message} Please try again in a minute, or give us a call.
            </p>
            <Link
              href="/menu"
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
