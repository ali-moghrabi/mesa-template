"use server";

import { requireTeam } from "@/lib/auth/get-user";
import { adminFetch, type ApiResult } from "./menu/api";
import type {
  AdminCampaign,
  AdminSubscriber,
  AutomationsView,
  CampaignDraft,
  CampaignFilters,
  CampaignsPage,
  DishOption,
  EmailPreview,
  NewsletterStats,
  SubscriberFilters,
  SubscribersPage,
  SubscriberStatus,
} from "./newsletter";

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const STATUSES: SubscriberStatus[] = ["subscribed", "pending", "unsubscribed"];
const notFound = {
  ok: false as const,
  status: 404,
  message: "This no longer exists. Refresh the page.",
};
const guard = () => requireTeam("content:manage");

export async function fetchNewsletterStats(): Promise<
  ApiResult<NewsletterStats>
> {
  await guard();
  return adminFetch<NewsletterStats>("/admin/newsletter/stats");
}

export async function fetchSubscribers(
  filters: SubscriberFilters,
): Promise<ApiResult<SubscribersPage>> {
  await guard();
  const query = new URLSearchParams();
  if (filters.q?.trim()) query.set("q", filters.q.trim().slice(0, 120));
  if (filters.status && STATUSES.includes(filters.status))
    query.set("status", filters.status);
  if (filters.page && filters.page > 1)
    query.set("page", String(Math.min(filters.page, 10_000)));
  return adminFetch<SubscribersPage>("/admin/newsletter/subscribers", {
    query,
  });
}

export async function exportSubscribers(
  status?: SubscriberStatus | "",
): Promise<ApiResult<AdminSubscriber[]>> {
  await guard();
  const query = new URLSearchParams();
  if (status && STATUSES.includes(status)) query.set("status", status);
  return adminFetch<AdminSubscriber[]>("/admin/newsletter/subscribers/export", {
    query,
  });
}

export async function addSubscriber(
  email: string,
  consent: "confirm" | "given",
): Promise<ApiResult<AdminSubscriber>> {
  await guard();
  return adminFetch<AdminSubscriber>("/admin/newsletter/subscribers", {
    method: "POST",
    body: {
      email: String(email).trim(),
      consent: consent === "given" ? "given" : "confirm",
    },
  });
}

export async function subscriberAction(
  id: string,
  action: "resend" | "unsubscribe" | "delete",
): Promise<ApiResult<AdminSubscriber | { deleted: true }>> {
  await guard();
  if (!OBJECT_ID.test(id)) return notFound;
  if (action === "delete")
    return adminFetch<{ deleted: true }>(
      `/admin/newsletter/subscribers/${id}`,
      { method: "DELETE" },
    );
  return adminFetch<AdminSubscriber>(
    `/admin/newsletter/subscribers/${id}/${action === "resend" ? "resend" : "unsubscribe"}`,
    { method: "POST" },
  );
}

const clean = (draft: CampaignDraft) => ({
  subject: String(draft.subject ?? "").slice(0, 120),
  preheader: String(draft.preheader ?? "").slice(0, 160),
  heading: String(draft.heading ?? "").slice(0, 120),
  body: String(draft.body ?? "").slice(0, 10_000),
  button:
    draft.button && draft.button.label.trim() && draft.button.url.trim()
      ? { label: draft.button.label.trim(), url: draft.button.url.trim() }
      : null,
  dishIds: (draft.dishIds ?? []).filter((id) => OBJECT_ID.test(id)).slice(0, 6),
});

export async function fetchCampaigns(
  filters: CampaignFilters,
): Promise<ApiResult<CampaignsPage>> {
  await guard();
  const query = new URLSearchParams();
  if (filters.status !== "all") query.set("status", filters.status);
  if (filters.page && filters.page > 1) query.set("page", String(filters.page));
  return adminFetch<CampaignsPage>("/admin/newsletter/campaigns", { query });
}

export async function fetchCampaign(
  id: string,
): Promise<ApiResult<AdminCampaign>> {
  await guard();
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<AdminCampaign>(`/admin/newsletter/campaigns/${id}`);
}

export async function createCampaign(
  draft: CampaignDraft,
): Promise<ApiResult<AdminCampaign>> {
  await guard();
  return adminFetch<AdminCampaign>("/admin/newsletter/campaigns", {
    method: "POST",
    body: clean(draft),
  });
}

export async function saveCampaign(
  id: string,
  draft: CampaignDraft,
  version: string,
): Promise<ApiResult<AdminCampaign>> {
  await guard();
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<AdminCampaign>(`/admin/newsletter/campaigns/${id}`, {
    method: "PATCH",
    body: { ...clean(draft), version },
  });
}

export async function previewCampaign(
  draft: CampaignDraft,
): Promise<ApiResult<EmailPreview>> {
  await guard();
  return adminFetch<EmailPreview>("/admin/newsletter/campaigns/preview", {
    method: "POST",
    body: clean(draft),
  });
}

export async function testCampaign(
  id: string,
  email?: string,
): Promise<ApiResult<{ sentTo: string }>> {
  await guard();
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<{ sentTo: string }>(
    `/admin/newsletter/campaigns/${id}/test`,
    { method: "POST", body: email?.trim() ? { email: email.trim() } : {} },
  );
}

export async function sendCampaign(
  id: string,
  version: string,
  at?: string,
): Promise<ApiResult<AdminCampaign>> {
  await guard();
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<AdminCampaign>(`/admin/newsletter/campaigns/${id}/send`, {
    method: "POST",
    body: { version, ...(at && { at }) },
  });
}

export async function campaignAction(
  id: string,
  action: "duplicate" | "unschedule" | "pause" | "resume" | "cancel",
): Promise<ApiResult<AdminCampaign>> {
  await guard();
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<AdminCampaign>(
    `/admin/newsletter/campaigns/${id}/${action}`,
    { method: "POST" },
  );
}

export async function deleteCampaign(
  id: string,
): Promise<ApiResult<{ deleted: true }>> {
  await guard();
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<{ deleted: true }>(`/admin/newsletter/campaigns/${id}`, {
    method: "DELETE",
  });
}

export async function fetchDishOptions(): Promise<ApiResult<DishOption[]>> {
  await guard();
  return adminFetch<DishOption[]>("/admin/newsletter/dishes");
}

export async function fetchAutomations(): Promise<ApiResult<AutomationsView>> {
  await guard();
  return adminFetch<AutomationsView>("/admin/newsletter/automations");
}

export async function saveAutomations(
  settings: Pick<AutomationsView, "welcome" | "sale">,
): Promise<ApiResult<AutomationsView>> {
  await guard();
  const { welcome, sale } = settings;
  return adminFetch<AutomationsView>("/admin/newsletter/automations", {
    method: "PATCH",
    body: {
      welcome: {
        enabled: !!welcome.enabled,
        message: String(welcome.message ?? "").slice(0, 1000),
      },
      sale: {
        enabled: !!sale.enabled,
        mode: sale.mode === "auto" ? "auto" : "review",
        minPercent: Math.min(
          90,
          Math.max(1, Math.round(Number(sale.minPercent) || 10)),
        ),
        cooldownDays: Math.min(
          30,
          Math.max(0, Math.round(Number(sale.cooldownDays) || 0)),
        ),
        intro: String(sale.intro ?? "").slice(0, 1000),
      },
    },
  });
}

export async function previewSaleEmail(): Promise<
  ApiResult<EmailPreview | null>
> {
  await guard();
  return adminFetch<EmailPreview | null>(
    "/admin/newsletter/automations/sale-preview",
  );
}
