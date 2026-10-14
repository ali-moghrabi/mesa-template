import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/auth/user-roles";
import { getOpeningHours } from "@/lib/opening-hours-server";
import { getPublicMenu } from "@/lib/menu/public-menu";
import { adminFetch } from "@/admin/lib/menu/api";
import type { Board } from "@/admin/lib/orders";
import { OrdersBoard } from "@/admin/components/orders/OrdersBoard";
import QueryWrapper from "@/components/providers/query-wrapper";
import { notFound } from "next/navigation";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Orders | ${brand.name} Admin` };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const EMPTY: Board = {
  active: [],
  done: [],
  counts: { placed: 0, accepted: 0, preparing: 0, ready: 0 },
  serverTime: new Date(0).toISOString(),
};

export default async function AdminOrdersPage({ searchParams }: Props) {
  const user = await requireTeam("orders:manage");
  const canEdit = hasPermission(user.role, "orders:edit");
  const config = getConfig();
  const params = await searchParams;
  const open =
    typeof params.order === "string" && /^[0-9a-f]{24}$/i.test(params.order)
      ? params.order
      : null;

  if (!config.features?.onlineOrdering) notFound();

  const [board, menu, hours] = await Promise.all([
    adminFetch<Board>("/admin/orders/board"),
    canEdit ? getPublicMenu() : null,
    getOpeningHours(),
  ]);

  return (
    <QueryWrapper>
      <OrdersBoard
        initialBoard={board.ok ? board.data : EMPTY}
        loadError={board.ok ? null : board.message}
        canEdit={canEdit}
        currency={config.menu.currency}
        timezone={hours?.timezone ?? config.business.timezone}
        timeFormat={
          (config as unknown as { locale?: { timeFormat?: string } }).locale
            ?.timeFormat === "12h"
            ? "12h"
            : "24h"
        }
        brandName={config.brand.name}
        menu={menu?.ok ? menu.menu.categories : []}
        initialOrderId={open}
        initialTab={params.tab === "history" ? "history" : "board"}
      />
    </QueryWrapper>
  );
}
