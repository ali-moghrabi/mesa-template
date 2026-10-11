import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { getOpeningHours } from "@/lib/opening-hours-server";
import { localClock } from "@/lib/promotions";
import { adminFetch } from "@/admin/lib/menu/api";
import {
  emptyPromotion,
  PRESETS,
  type PresetKey,
  type PromotionCatalog,
} from "@/admin/lib/promotions";
import { PromotionForm } from "@/admin/components/promotions/PromotionsClient";
import { PromotionPageShell } from "../shell";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `New promotion | ${brand.name} Admin` };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewPromotionPage({ searchParams }: Props) {
  await requireTeam("menu:manage");
  const config = getConfig();
  const preset = (await searchParams).preset;
  const key =
    typeof preset === "string" && preset in PRESETS
      ? (preset as PresetKey)
      : undefined;
  const timezone =
    (await getOpeningHours())?.timezone ?? config.business.timezone;
  const catalog = await adminFetch<PromotionCatalog>(
    "/admin/menu/promotions/catalog",
  );

  return (
    <PromotionPageShell
      title="New promotion"
      error={catalog.ok ? null : catalog.message}
    >
      {catalog.ok && (
        <QueryWrapper>
          <PromotionForm
            initial={emptyPromotion(localClock(timezone).date, key)}
            catalog={catalog.data}
            currency={config.menu.currency.primary.code}
            timezone={timezone}
          />
        </QueryWrapper>
      )}
    </PromotionPageShell>
  );
}
