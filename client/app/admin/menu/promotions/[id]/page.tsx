import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { getOpeningHours } from "@/lib/opening-hours-server";
import { localClock } from "@/lib/promotions";
import { adminFetch } from "@/admin/lib/menu/api";
import {
  toFormValues,
  type AdminPromotion,
  type PromotionCatalog,
} from "@/admin/lib/promotions";
import { PromotionForm } from "@/admin/components/promotions/PromotionsClient";
import { PromotionPageShell } from "../shell";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Edit promotion | ${brand.name} Admin` };
}

type Props = { params: Promise<{ id: string }> };

export default async function EditPromotionPage({ params }: Props) {
  await requireTeam("menu:manage");
  const { id } = await params;
  if (!/^[0-9a-f]{24}$/i.test(id)) notFound();

  const config = getConfig();
  const timezone =
    (await getOpeningHours())?.timezone ?? config.business.timezone;
  const [promotion, catalog] = await Promise.all([
    adminFetch<AdminPromotion>(`/admin/menu/promotions/${id}`),
    adminFetch<PromotionCatalog>("/admin/menu/promotions/catalog"),
  ]);
  if (!promotion.ok && promotion.status === 404) notFound();

  const error = !promotion.ok
    ? promotion.message
    : !catalog.ok
      ? catalog.message
      : null;
  return (
    <PromotionPageShell
      title={promotion.ok ? promotion.data.name : "Edit promotion"}
      eyebrow="Edit promotion"
      error={error}
    >
      {promotion.ok && catalog.ok && (
        <QueryWrapper>
          <PromotionForm
            key={promotion.data.updatedAt}
            promotion={promotion.data}
            initial={toFormValues(promotion.data, localClock(timezone).date)}
            catalog={catalog.data}
            currency={config.menu.currency.primary.code}
            timezone={timezone}
          />
        </QueryWrapper>
      )}
    </PromotionPageShell>
  );
}
