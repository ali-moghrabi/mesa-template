import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { adminFetch } from "@/admin/lib/menu/api";
import {
  NEWSLETTER_TABS,
  type NewsletterStats,
  type NewsletterTab,
} from "@/admin/lib/newsletter";
import QueryWrapper from "@/components/providers/query-wrapper";
import { NewsletterAdmin } from "@/admin/components/newsletter/NewsletterAdmin";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Newsletter | ${brand.name} Admin` };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminNewsletterPage({ searchParams }: Props) {
  await requireTeam("content:manage");
  const { features } = getConfig() as unknown as {
    features?: { newsletter?: boolean };
  };
  if (features?.newsletter !== true) notFound();

  const params = await searchParams;
  const tab =
    typeof params.tab === "string" &&
    (NEWSLETTER_TABS as readonly string[]).includes(params.tab)
      ? (params.tab as NewsletterTab)
      : "overview";
  const campaign =
    typeof params.campaign === "string" &&
    /^[0-9a-f]{24}$/i.test(params.campaign)
      ? params.campaign
      : null;
  const stats = await adminFetch<NewsletterStats>("/admin/newsletter/stats");

  return (
    <QueryWrapper>
      <NewsletterAdmin
        initialStats={stats.ok ? stats.data : null}
        loadError={stats.ok ? null : stats.message}
        initialTab={tab}
        initialCampaign={campaign}
      />
    </QueryWrapper>
  );
}
