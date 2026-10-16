import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { QrCodes, type QrTarget } from "@/admin/components/shared/QrCodes";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `QR codes | ${brand.name} Admin` };
}

export default async function AdminQrPage() {
  await requireTeam();
  const config = getConfig();
  const pages =
    (
      config as unknown as {
        pages?: Record<string, { enabled?: boolean } | undefined>;
      }
    ).pages ?? {};

  const targets: QrTarget[] = [
    pages.menu?.enabled !== false && {
      id: "menu" as const,
      label: "The menu",
      path: "/menu",
    },
    { id: "home" as const, label: "The website", path: "/" },
    config.features?.reservations &&
      pages.reservations?.enabled !== false && {
        id: "reservations" as const,
        label: "Book a table",
        path: "/reservations",
      },
  ].filter((t): t is QrTarget => !!t);

  const logo = config.brand.logo?.light;

  return (
    <QrCodes
      siteUrl={config.seo.siteUrl}
      brandName={config.brand.name}
      logo={logo ? (/^(https?:)?\//.test(logo) ? logo : `/${logo}`) : undefined}
      primary={config.theme.colors.light.primary}
      targets={targets}
      ordering={
        config.features?.onlineOrdering === true ||
        config.features?.whatsappOrdering === true
      }
    />
  );
}
