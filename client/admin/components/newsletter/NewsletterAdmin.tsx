"use client";

/**
 * /admin/newsletter (managers and the owner):
 *   Overview     how the list grows, where people sign up, why they leave, the latest newsletters
 *   Newsletters  write, preview, test, send or schedule (Campaigns.tsx)
 *   Subscribers  search, add, resend the confirmation, unsubscribe, erase, export to CSV
 *   Automations  the welcome email and the sale alert (Automations.tsx)
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Download,
  Inbox,
  Loader2,
  LogOut,
  Mail,
  MailCheck,
  MailQuestion,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CAMPAIGN_STATUS,
  campaignsKey,
  formatDate,
  NEWSLETTER_PATH,
  NEWSLETTER_ROOT,
  REASON_LABELS,
  SOURCE_LABELS,
  STATS_KEY,
  SUBSCRIBER_STATUS,
  subscribersCsv,
  subscribersKey,
  type AdminSubscriber,
  type CampaignFilter,
  type NewsletterStats,
  type NewsletterTab,
  type SubscriberStatus,
} from "@/admin/lib/newsletter";
import {
  addSubscriber,
  exportSubscribers,
  fetchCampaigns,
  fetchNewsletterStats,
  fetchSubscribers,
  subscriberAction,
} from "@/admin/lib/newsletter.actions";
import { AutomationsTab } from "./Automations";
import { campaignLine, CampaignSheet, CampaignsTab } from "./Campaigns";
import {
  Card,
  Confirm,
  Empty,
  FIELD,
  Loading,
  Pill,
  PRIMARY,
  SECONDARY,
  unwrap,
} from "./parts";

type Props = {
  initialStats: NewsletterStats | null;
  loadError: string | null;
  initialTab: NewsletterTab;
  initialCampaign: string | null;
};

const TABS: { id: NewsletterTab; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "campaigns", label: "Newsletters", icon: Mail },
  { id: "subscribers", label: "Subscribers", icon: Users },
  { id: "automations", label: "Automations", icon: Zap },
];

const noSubscribe = () => () => {};

export function NewsletterAdmin({
  initialStats,
  loadError,
  initialTab,
  initialCampaign,
}: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<NewsletterTab>(initialTab);
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>("all");
  const [open, setOpen] = useState<string | null>(initialCampaign);

  const stats = useQuery({
    queryKey: STATS_KEY,
    queryFn: () => unwrap(fetchNewsletterStats()),
    initialData: initialStats ?? undefined,
    refetchInterval: 60_000,
  });
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  useEffect(() => {
    if (initialStats) queryClient.setQueryData(STATS_KEY, initialStats);
  }, [initialStats, queryClient]);
  const data = hydrated ? (stats.data ?? initialStats) : initialStats;

  const go = (next: NewsletterTab, filter?: CampaignFilter) => {
    setTab(next);
    if (filter) setCampaignFilter(filter);
    window.history.replaceState(
      null,
      "",
      next === "overview" ? NEWSLETTER_PATH : `${NEWSLETTER_PATH}?tab=${next}`,
    );
  };
  const openCampaign = (id: string | null) => setOpen(id);
  const subscribed = data?.counts.subscribed ?? 0;

  return (
    <div className="mx-auto w-full max-w-350 px-4 pb-16 contain-[inline-size] sm:px-8">
      <header className="flex flex-col gap-4 pt-6 pb-5 lg:flex-row lg:items-end lg:justify-between lg:pt-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Marketing
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
            Newsletter
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-[15px]">
            {data
              ? `${subscribed.toLocaleString()} ${subscribed === 1 ? "subscriber" : "subscribers"}${data.lastCampaign ? ` · last newsletter ${formatDate(data.lastCampaign.sentAt, { day: "numeric", month: "short" })}` : ""}`
              : "Your list, your newsletters and the emails that go out by themselves."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCampaign("new")}
          className={cn(PRIMARY, "h-11 self-start lg:self-auto")}
        >
          <Plus className="size-4" /> New newsletter
        </button>
      </header>

      {loadError && !data && (
        <p
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-300"
        >
          <AlertTriangle className="size-4 shrink-0" /> {loadError}
        </p>
      )}

      {data && data.toReview > 0 && (
        <button
          type="button"
          onClick={() => go("campaigns", "review")}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-3 text-left transition-colors hover:border-amber-500/50"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-white">
            <Sparkles className="size-4" />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">
              {data.toReview} sale{" "}
              {data.toReview === 1 ? "email is" : "emails are"} ready for you
            </span>{" "}
            <span className="text-muted-foreground">
              A promotion started: check it and send.
            </span>
          </span>
          <span className="hidden text-sm font-semibold text-amber-800 sm:block dark:text-amber-300">
            Review
          </span>
        </button>
      )}

      <div
        role="tablist"
        aria-label="Newsletter"
        className="mb-5 flex gap-1 overflow-x-auto border-b border-border scrollbar-none"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => go(t.id)}
            className={cn(
              "relative inline-flex h-11 shrink-0 items-center gap-2 px-3.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
            {t.id === "campaigns" && !!data?.toReview && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white tabular-nums">
                {data.toReview}
              </span>
            )}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab stats={data} onTab={go} onOpen={openCampaign} />
      )}
      {tab === "campaigns" && (
        <CampaignsTab
          key={campaignFilter}
          initialFilter={campaignFilter}
          onOpen={openCampaign}
          onNew={() => openCampaign("new")}
        />
      )}
      {tab === "subscribers" && <SubscribersTab />}
      {tab === "automations" && (
        <AutomationsTab onOpenCampaign={openCampaign} />
      )}

      <CampaignSheet
        open={open}
        onClose={() => openCampaign(null)}
        onOpened={(id) => openCampaign(id)}
        subscribers={subscribed}
      />
    </div>
  );
}

/* ═════════════ overview ═════════════ */

function OverviewTab({
  stats,
  onTab,
  onOpen,
}: {
  stats: NewsletterStats | null | undefined;
  onTab: (t: NewsletterTab, f?: CampaignFilter) => void;
  onOpen: (id: string) => void;
}) {
  const recent = useQuery({
    queryKey: campaignsKey({ status: "all" }),
    queryFn: () => unwrap(fetchCampaigns({ status: "all" })),
  });
  if (!stats) return <Loading />;
  const { counts } = stats;

  const tiles = [
    {
      label: "Subscribers",
      value: counts.subscribed,
      hint: "Getting your newsletters",
      icon: MailCheck,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "Joined",
      value: stats.joined30,
      hint: "Confirmed in the last 30 days",
      icon: UserPlus,
      tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Left",
      value: stats.left30,
      hint: "Unsubscribed in the last 30 days",
      icon: LogOut,
      tone: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400",
    },
    {
      label: "Not confirmed",
      value: counts.pending,
      hint: "Signed up, haven't clicked the link",
      icon: MailQuestion,
      tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                {t.label}
              </p>
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-xl",
                  t.tone,
                )}
              >
                <t.icon className="size-4" />
              </span>
            </div>
            <div>
              <p className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
                {t.value.toLocaleString()}
              </p>
              <p className="mt-1.5 truncate text-xs text-muted-foreground">
                {t.hint}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
        <div className="grid content-start gap-4 lg:col-span-8">
          <Card
            title="Growth"
            subtitle="Last 30 days"
            icon={TrendingUp}
            actions={
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                  stats.joined30 - stats.left30 >= 0
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-500/12 text-rose-700 dark:text-rose-300",
                )}
              >
                {stats.joined30 - stats.left30 >= 0 ? "+" : "−"}
                {Math.abs(stats.joined30 - stats.left30)} net
              </span>
            }
          >
            <GrowthChart daily={stats.daily} />
          </Card>
          <Card
            title="Latest newsletters"
            icon={Send}
            actions={
              <button
                type="button"
                onClick={() => onTab("campaigns")}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                See all
              </button>
            }
          >
            {recent.isPending ? (
              <Loading className="py-8" />
            ) : !recent.data?.items.length ? (
              <Empty
                icon={Inbox}
                title="Nothing sent yet"
                text="Your first newsletter is one click away: “New newsletter”, top right."
              />
            ) : (
              <ul className="-mx-2 divide-y divide-border">
                {recent.data.items.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(c.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {c.subject || "No subject"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {campaignLine(c)}
                        </span>
                      </span>
                      {c.kind === "sale" && (
                        <Wand2
                          className="size-4 text-muted-foreground"
                          aria-label="Sale alert"
                        />
                      )}
                      <Pill meta={CAMPAIGN_STATUS[c.status]} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="grid content-start gap-4 lg:col-span-4">
          <Card title="Where they sign up" icon={UserPlus}>
            {stats.sources.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No subscribers yet. The sign-up form is on your home page.
              </p>
            ) : (
              <Bars
                rows={stats.sources.map((s) => ({
                  key: s.source,
                  label: SOURCE_LABELS[s.source] ?? s.source,
                  count: s.count,
                }))}
                tone="bg-primary"
              />
            )}
          </Card>
          <Card title="Why they left" subtitle="Last 90 days" icon={UserMinus}>
            {stats.reasons.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nobody has left. 🎉
              </p>
            ) : (
              <Bars
                rows={stats.reasons.map((r) => ({
                  key: r.reason,
                  label: REASON_LABELS[r.reason] ?? r.reason,
                  count: r.count,
                }))}
                tone="bg-foreground/35"
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Joined (up) and left (down), one pair of bars per day */
function GrowthChart({ daily }: { daily: NewsletterStats["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => Math.max(d.joined, d.left)));
  const empty = daily.every((d) => !d.joined && !d.left);
  return (
    <div>
      <div
        className="relative"
        role="img"
        aria-label="Sign-ups and unsubscribes per day over the last 30 days"
      >
        {empty && (
          <p className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">
            No sign-ups or unsubscribes in the last 30 days.
          </p>
        )}
        <div
          className={cn("flex h-28 items-end gap-0.75", empty && "opacity-30")}
        >
          {daily.map((d) => (
            <div
              key={d.date}
              className="group relative flex h-full min-w-0 flex-1 items-end"
              tabIndex={0}
            >
              <div
                className={cn(
                  "w-full rounded-t-[3px]",
                  d.joined
                    ? "bg-primary/80 group-hover:bg-primary"
                    : "h-0.5 rounded-full bg-foreground/10",
                )}
                style={
                  d.joined
                    ? { height: `${(d.joined / max) * 100}%` }
                    : undefined
                }
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max -translate-x-1/2 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
                <span className="block font-semibold">
                  {formatDate(`${d.date}T12:00:00Z`, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="block tabular-nums">+{d.joined} joined</span>
                <span className="block text-muted-foreground tabular-nums">
                  −{d.left} left
                </span>
              </span>
            </div>
          ))}
        </div>
        <div
          className={cn(
            "flex h-12 items-start gap-0.75 border-t border-border",
            empty && "opacity-30",
          )}
        >
          {daily.map((d) => (
            <div
              key={d.date}
              className="flex h-full min-w-0 flex-1 items-start"
            >
              {d.left > 0 && (
                <div
                  className="w-full rounded-b-[3px] bg-foreground/30"
                  style={{ height: `${(d.left / max) * 100}%` }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {formatDate(`${daily[0]?.date}T12:00:00Z`, {
            day: "numeric",
            month: "short",
          })}
        </span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-primary/80" /> Joined
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-foreground/30" /> Left
          </span>
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Bars({
  rows,
  tone,
}: {
  rows: { key: string; label: string; count: number }[];
  tone: string;
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {r.count.toLocaleString()} · {Math.round((r.count / total) * 100)}
              %
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", tone)}
              style={{ width: `${(r.count / total) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ═════════════ subscribers ═════════════ */

const STATUS_FILTERS: {
  id: SubscriberStatus | "";
  label: string;
  count: "all" | SubscriberStatus;
}[] = [
  { id: "", label: "All", count: "all" },
  { id: "subscribed", label: "Subscribed", count: "subscribed" },
  { id: "pending", label: "Not confirmed", count: "pending" },
  { id: "unsubscribed", label: "Unsubscribed", count: "unsubscribed" },
];

function SubscribersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<SubscriberStatus | "">("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [erasing, setErasing] = useState<AdminSubscriber | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters = { q, status, page };
  const list = useQuery({
    queryKey: subscribersKey(filters),
    queryFn: () => unwrap(fetchSubscribers(filters)),
    placeholderData: keepPreviousData,
  });

  const act = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "resend" | "unsubscribe" | "delete";
    }) => unwrap(subscriberAction(id, action)),
    onSuccess: (_r, { action }) => {
      setErasing(null);
      queryClient.invalidateQueries({ queryKey: NEWSLETTER_ROOT });
      toast.add({
        title: {
          resend: "Confirmation email sent again",
          unsubscribe: "Unsubscribed",
          delete: "Erased for good",
        }[action],
        type: "success",
      });
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't do that",
        description: e.message,
        type: "error",
      }),
  });

  const download = async () => {
    setExporting(true);
    try {
      const rows = await unwrap(exportSubscribers(status));
      const blob = new Blob([subscribersCsv(rows)], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `subscribers${status ? `-${status}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      a.click();
      URL.revokeObjectURL(url);
      toast.add({
        title: `${rows.length.toLocaleString()} ${rows.length === 1 ? "address" : "addresses"} exported`,
        type: "success",
      });
    } catch (e) {
      toast.add({
        title: "Couldn't export",
        description: (e as Error).message,
        type: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  const counts = list.data?.counts;
  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-3">
        <div className="relative order-1 min-w-0 flex-1 lg:w-80 lg:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email"
            aria-label="Search subscribers"
            className={cn(FIELD, "h-10 bg-card pl-9")}
          />
        </div>
        <div
          className="order-3 -mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none sm:mx-0 sm:w-full sm:flex-wrap sm:px-0 lg:order-2 lg:w-auto lg:flex-1"
          role="tablist"
          aria-label="Status"
        >
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              role="tab"
              aria-selected={status === f.id}
              onClick={() => {
                setStatus(f.id);
                setPage(1);
              }}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                status === f.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              {counts && (
                <span className="text-xs opacity-60 tabular-nums">
                  {counts[f.count].toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="order-2 flex shrink-0 gap-2 lg:order-3">
          <button
            type="button"
            onClick={download}
            disabled={exporting}
            className={cn(SECONDARY, "px-3 sm:px-4")}
            aria-label="Export to CSV"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}{" "}
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={PRIMARY}
          >
            <UserPlus className="size-4" /> Add
          </button>
        </div>
      </div>

      <Card
        className={cn(
          "p-0 transition-opacity sm:p-0",
          list.isPlaceholderData && "opacity-70",
        )}
      >
        {list.isPending ? (
          <Loading />
        ) : list.isError ? (
          <Empty
            icon={AlertTriangle}
            title="Couldn't load the subscribers"
            text={list.error.message}
            action={
              <button
                type="button"
                className={SECONDARY}
                onClick={() => list.refetch()}
              >
                Try again
              </button>
            }
          />
        ) : items.length === 0 ? (
          <Empty
            icon={Users}
            title={q || status ? "Nobody matches" : "No subscribers yet"}
            text={
              q || status
                ? "Try another search or status."
                : "People join from the form on your website. You can also add someone who signed up in person."
            }
          />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.6fr)_9rem_minmax(0,1fr)_7.5rem_2.5rem] gap-4 border-b border-border px-5 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid">
              <span>Email</span>
              <span>Status</span>
              <span>Source</span>
              <span>Since</span>
              <span />
            </div>
            <ul className="divide-y divide-border">
              {items.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3 md:grid md:grid-cols-[minmax(0,1.6fr)_9rem_minmax(0,1fr)_7.5rem_2.5rem] md:gap-4 md:px-5"
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold uppercase md:hidden",
                      SUBSCRIBER_STATUS[s.status].pill,
                    )}
                  >
                    {s.email.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {s.email}
                    </span>
                    {s.unsubscribeReason && s.status === "unsubscribed" && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {REASON_LABELS[s.unsubscribeReason] ??
                          s.unsubscribeReason}
                      </span>
                    )}
                    <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground md:hidden">
                      <Pill meta={SUBSCRIBER_STATUS[s.status]} />
                      <span className="truncate">
                        {SOURCE_LABELS[s.source]} ·{" "}
                        {formatDate(s.confirmedAt ?? s.createdAt, {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </span>
                  </span>
                  <span className="hidden md:block">
                    <Pill meta={SUBSCRIBER_STATUS[s.status]} />
                  </span>
                  <span className="hidden truncate text-sm text-muted-foreground md:block">
                    {SOURCE_LABELS[s.source] ?? s.source}
                  </span>
                  <span className="hidden text-sm text-muted-foreground tabular-nums md:block">
                    {formatDate(
                      s.status === "unsubscribed" && s.unsubscribedAt
                        ? s.unsubscribedAt
                        : (s.confirmedAt ?? s.createdAt),
                    )}
                  </span>
                  <span className="shrink-0 justify-self-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-popup-open:bg-muted"
                        aria-label={`Actions for ${s.email}`}
                      >
                        <MoreHorizontal className="size-4.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={6}
                        className="w-56 rounded-xl bg-card p-1.5 text-foreground shadow-lg"
                      >
                        {s.status === "pending" && (
                          <DropdownMenuItem
                            onClick={() =>
                              act.mutate({ id: s.id, action: "resend" })
                            }
                            className={MENU_ITEM}
                          >
                            <Mail className="size-4" /> Resend confirmation
                          </DropdownMenuItem>
                        )}
                        {s.status !== "unsubscribed" && (
                          <DropdownMenuItem
                            onClick={() =>
                              act.mutate({ id: s.id, action: "unsubscribe" })
                            }
                            className={MENU_ITEM}
                          >
                            <UserMinus className="size-4" /> Unsubscribe
                          </DropdownMenuItem>
                        )}
                        {s.status !== "unsubscribed" && (
                          <DropdownMenuSeparator className="my-1" />
                        )}
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setErasing(s)}
                          className={MENU_ITEM}
                        >
                          <Trash2 className="size-4" /> Erase completely
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </li>
              ))}
            </ul>
            {list.data && list.data.pages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
                <span>
                  {list.data.total.toLocaleString()} people · page{" "}
                  {list.data.page} of {list.data.pages}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className={SECONDARY}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className={SECONDARY}
                    disabled={page >= list.data.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </span>
              </div>
            )}
          </>
        )}
      </Card>

      <AddDialog open={adding} onClose={() => setAdding(false)} />
      <Confirm
        open={erasing !== null}
        title="Erase this address completely?"
        text={
          <>
            <span className="font-medium text-foreground">
              {erasing?.email}
            </span>{" "}
            and its sign-up record are deleted for good. Use this when someone
            asks to be forgotten; if they just want no more emails, unsubscribe
            them instead.
          </>
        }
        action="Erase"
        danger
        busy={act.isPending}
        onConfirm={() =>
          erasing && act.mutate({ id: erasing.id, action: "delete" })
        }
        onClose={() => setErasing(null)}
      />
    </div>
  );
}

const MENU_ITEM =
  "cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground";

function AddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState<"confirm" | "given">("confirm");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const add = useMutation({
    mutationFn: () => unwrap(addSubscriber(email, consent)),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: NEWSLETTER_ROOT });
      toast.add({
        title:
          s.status === "subscribed"
            ? "Added to the list"
            : "Confirmation email sent",
        description:
          s.status === "subscribed"
            ? s.email
            : `${s.email} joins once they click the link.`,
        type: "success",
      });
      setEmail("");
      onClose();
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't add them",
        description: e.message,
        type: "error",
      }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !add.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a subscriber</DialogTitle>
          <DialogDescription>
            Only add people who asked for your newsletter.
          </DialogDescription>
        </DialogHeader>
        <form
          id="add-subscriber"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) add.mutate();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guest@example.com"
              className={cn(FIELD, "h-11")}
              autoFocus
            />
          </label>
          <div className="grid gap-2">
            {(
              [
                [
                  "confirm",
                  MailCheck,
                  "Send them a confirmation email",
                  "They join once they click the link. The safe choice.",
                ],
                [
                  "given",
                  UserPlus,
                  "They already agreed",
                  "E.g. they signed up on paper at the restaurant. Added at once.",
                ],
              ] as const
            ).map(([id, Icon, title, text]) => (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                  consent === id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="consent"
                  checked={consent === id}
                  onChange={() => setConsent(id)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg",
                    consent === id
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {text}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </form>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className={SECONDARY}
            disabled={add.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-subscriber"
            disabled={!valid || add.isPending}
            className={PRIMARY}
          >
            {add.isPending && <Loader2 className="size-4 animate-spin" />} Add
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
