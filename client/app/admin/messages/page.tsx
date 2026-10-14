import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { adminFetch } from "@/admin/lib/menu/api";
import type { MessagesPage } from "@/admin/lib/messages";
import QueryWrapper from "@/components/providers/query-wrapper";
import { MessagesInbox } from "@/admin/components/messages/MessagesInbox";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Messages | ${brand.name} Admin` };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminMessagesPage({ searchParams }: Props) {
  await requireTeam("content:manage");
  const config = getConfig() as unknown as {
    brand: { name: string };
    business: { timezone?: string };
  };
  const params = await searchParams;
  const id =
    typeof params.message === "string" && /^[0-9a-f]{24}$/i.test(params.message)
      ? params.message
      : null;
  const first = await adminFetch<MessagesPage>("/admin/messages", {
    query: new URLSearchParams({ view: "inbox" }),
  });

  return (
    <QueryWrapper>
      <MessagesInbox
        initial={first.ok ? first.data : null}
        loadError={first.ok ? null : first.message}
        timezone={config.business.timezone ?? "UTC"}
        brandName={config.brand.name}
        initialId={id}
      />
    </QueryWrapper>
  );
}
