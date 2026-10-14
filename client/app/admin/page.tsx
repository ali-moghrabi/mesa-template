import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { adminFetch } from "@/admin/lib/menu/api";
import {
  parseRange,
  type Overview as OverviewData,
} from "@/admin/lib/overview";
import QueryWrapper from "@/components/providers/query-wrapper";
import { Overview } from "@/admin/components/overview/Overview";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Overview | ${brand.name} Admin` };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminOverviewPage({ searchParams }: Props) {
  const user = await requireTeam();
  const config = getConfig() as unknown as { locale?: { timeFormat?: string } };
  const range = parseRange((await searchParams).range);
  const result = await adminFetch<OverviewData>("/admin/overview", {
    query: new URLSearchParams({ range: String(range) }),
  });

  return (
    <QueryWrapper>
      <Overview
        initial={result.ok ? result.data : null}
        loadError={result.ok ? null : result.message}
        initialRange={range}
        firstName={user.firstName}
        timeFormat={config.locale?.timeFormat === "12h" ? "12h" : "24h"}
      />
    </QueryWrapper>
  );
}
