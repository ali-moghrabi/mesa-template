import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/auth/user-roles";
import { adminFetch } from "@/admin/lib/menu/api";
import type { DayView } from "@/admin/lib/reservations";
import QueryWrapper from "@/components/providers/query-wrapper";
import { ReservationsAdmin } from "@/admin/components/reservations/ReservationsAdmin";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Reservations | ${brand.name} Admin` };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminReservationsPage({ searchParams }: Props) {
  const user = await requireTeam("reservations:view");
  const config = getConfig();

  if (!config.features?.reservations) notFound();

  const params = await searchParams;
  const one = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  const date = one("date");
  const booking = one("booking");
  const tab = one("tab");

  const query = new URLSearchParams();
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) query.set("date", date);
  const day = await adminFetch<DayView>("/admin/reservations/day", { query });

  return (
    <QueryWrapper>
      <ReservationsAdmin
        initialDay={day.ok ? day.data : null}
        loadError={day.ok ? null : day.message}
        canManage={hasPermission(user.role, "reservations:manage")}
        timeFormat={config.locale?.timeFormat === "12h" ? "12h" : "24h"}
        occasions={config.business.reservations?.occasions ?? []}
        initialId={booking && /^[0-9a-f]{24}$/i.test(booking) ? booking : null}
        initialTab={tab === "requests" || tab === "all" ? tab : "day"}
      />
    </QueryWrapper>
  );
}
