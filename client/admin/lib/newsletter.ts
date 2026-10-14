export const NEWSLETTER_PATH = "/admin/newsletter";
export const NEWSLETTER_TABS = [
  "overview",
  "campaigns",
  "subscribers",
  "automations",
] as const;
export type NewsletterTab = (typeof NEWSLETTER_TABS)[number];

export const NEWSLETTER_ROOT = ["admin-newsletter"] as const;
export const STATS_KEY = ["admin-newsletter", "stats"] as const;
export const subscribersKey = (filters: SubscriberFilters) =>
  ["admin-newsletter", "subscribers", filters] as const;
export const campaignsKey = (filters: CampaignFilters) =>
  ["admin-newsletter", "campaigns", filters] as const;
export const campaignKey = (id: string) =>
  ["admin-newsletter", "campaign", id] as const;
export const DISHES_KEY = ["admin-newsletter", "dishes"] as const;
export const AUTOMATIONS_KEY = ["admin-newsletter", "automations"] as const;

export type SubscriberStatus = "pending" | "subscribed" | "unsubscribed";
export type SubscriberSource =
  | "website"
  | "footer"
  | "popup"
  | "admin"
  | "import";

export type AdminSubscriber = {
  id: string;
  email: string;
  status: SubscriberStatus;
  source: SubscriberSource;
  createdAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  unsubscribeReason: string | null;
};

export type SubscriberCounts = {
  all: number;
  subscribed: number;
  pending: number;
  unsubscribed: number;
};
export type SubscribersPage = {
  items: AdminSubscriber[];
  total: number;
  page: number;
  pages: number;
  counts: SubscriberCounts;
};
export type SubscriberFilters = {
  q?: string;
  status?: SubscriberStatus | "";
  page?: number;
};

export type NewsletterStats = {
  counts: SubscriberCounts;
  daily: { date: string; joined: number; left: number }[];
  joined30: number;
  left30: number;
  sources: { source: SubscriberSource; count: number }[];
  reasons: { reason: string; count: number }[];
  lastCampaign: {
    id: string;
    subject: string;
    sentAt: string;
    sent: number;
  } | null;
  toReview: number;
};

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "cancelled";
export type CampaignKind = "manual" | "sale";

export type CampaignSummary = {
  id: string;
  kind: CampaignKind;
  status: CampaignStatus;
  subject: string;
  preheader: string;
  needsReview: boolean;
  scheduledAt: string | null;
  startedAt: string | null;
  sentAt: string | null;
  stats: { recipients: number; sent: number; failed: number };
  createdBy: string | null;
  sentBy: string | null;
  updatedAt: string;
};

export type AdminCampaign = CampaignSummary & {
  heading: string;
  body: string;
  button: { label: string; url: string } | null;
  dishIds: string[];
  lastError: string | null;
  version: string;
};

export type CampaignFilter =
  | "all"
  | "review"
  | "draft"
  | "scheduled"
  | "sending"
  | "sent";
export type CampaignFilters = { status: CampaignFilter; page?: number };
export type CampaignsPage = {
  items: CampaignSummary[];
  total: number;
  page: number;
  pages: number;
  counts: Record<
    "all" | "draft" | "scheduled" | "sending" | "sent" | "review",
    number
  >;
};

export type CampaignDraft = {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  button: { label: string; url: string } | null;
  dishIds: string[];
};

export type DishOption = {
  id: string;
  name: string;
  image?: string;
  category: string;
};

export type AutomationsView = {
  welcome: { enabled: boolean; message: string };
  sale: {
    enabled: boolean;
    mode: "auto" | "review";
    minPercent: number;
    cooldownDays: number;
    intro: string;
    lastSentAt: string | null;
  };
  pending: { id: string; name: string; percentOff: number; hours: string }[];
  nextAllowedAt: string | null;
  recent: CampaignSummary[];
};

export type EmailPreview = { subject: string; html: string };

export const SUBSCRIBER_STATUS: Record<
  SubscriberStatus,
  { label: string; pill: string; dot: string }
> = {
  subscribed: {
    label: "Subscribed",
    pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  pending: {
    label: "Not confirmed",
    pill: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  unsubscribed: {
    label: "Unsubscribed",
    pill: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
};

export const CAMPAIGN_STATUS: Record<
  CampaignStatus,
  { label: string; pill: string; dot: string }
> = {
  draft: {
    label: "Draft",
    pill: "bg-zinc-500/12 text-zinc-700 dark:text-zinc-300",
    dot: "bg-zinc-400",
  },
  scheduled: {
    label: "Scheduled",
    pill: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  sending: {
    label: "Sending",
    pill: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  sent: {
    label: "Sent",
    pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  paused: {
    label: "Paused",
    pill: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  cancelled: {
    label: "Cancelled",
    pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

export const SOURCE_LABELS: Record<SubscriberSource, string> = {
  website: "Website form",
  footer: "Footer",
  popup: "Pop-up",
  admin: "Added by the team",
  import: "Imported",
};

export const REASON_LABELS: Record<string, string> = {
  too_many: "Too many emails",
  not_relevant: "Not interested anymore",
  never_signed_up: "Never signed up",
  other: "Something else",
  removed_by_team: "Removed by the team",
  none: "No reason given",
};

export const EMPTY_DRAFT: CampaignDraft = {
  subject: "",
  preheader: "",
  heading: "",
  body: "",
  button: null,
  dishIds: [],
};
export const MAX_DISHES = 6;
export const LINK_PATTERN = /^(\/[^\s]*|https?:\/\/[^\s]+)$/;

export const draftOf = (c: AdminCampaign): CampaignDraft => ({
  subject: c.subject,
  preheader: c.preheader,
  heading: c.heading,
  body: c.body,
  button: c.button,
  dishIds: c.dishIds,
});

export const sameDraft = (a: CampaignDraft, b: CampaignDraft) =>
  JSON.stringify(a) === JSON.stringify(b);
export const isEditable = (status: CampaignStatus) =>
  status === "draft" || status === "scheduled";

export const formatDate = (
  iso: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
) => new Intl.DateTimeFormat("en-GB", options).format(new Date(iso));

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export function subscribersCsv(rows: AdminSubscriber[]): string {
  const cell = (v: string | null) => {
    const s = v ?? "";
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = [
    "Email",
    "Status",
    "Source",
    "Signed up",
    "Confirmed",
    "Unsubscribed",
    "Reason",
  ];
  const lines = rows.map((r) =>
    [
      r.email,
      SUBSCRIBER_STATUS[r.status].label,
      SOURCE_LABELS[r.source] ?? r.source,
      r.createdAt,
      r.confirmedAt,
      r.unsubscribedAt,
      r.unsubscribeReason
        ? (REASON_LABELS[r.unsubscribeReason] ?? r.unsubscribeReason)
        : "",
    ]
      .map(cell)
      .join(","),
  );
  return "﻿" + [header.join(","), ...lines].join("\r\n");
}
