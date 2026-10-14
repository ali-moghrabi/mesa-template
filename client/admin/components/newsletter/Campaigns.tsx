"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  Bold,
  CalendarClock,
  Check,
  Copy,
  Eye,
  FlaskConical,
  Heading2,
  Link2,
  List,
  Loader2,
  Mail,
  MoreHorizontal,
  Pause,
  PencilLine,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
  UtensilsCrossed,
  X,
  XCircle,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CAMPAIGN_STATUS,
  campaignKey,
  campaignsKey,
  DISHES_KEY,
  draftOf,
  EMPTY_DRAFT,
  formatDate,
  formatDateTime,
  isEditable,
  LINK_PATTERN,
  MAX_DISHES,
  NEWSLETTER_ROOT,
  sameDraft,
  type AdminCampaign,
  type CampaignDraft,
  type CampaignFilter,
  type CampaignSummary,
} from "@/admin/lib/newsletter";
import {
  campaignAction,
  createCampaign,
  deleteCampaign,
  fetchCampaign,
  fetchCampaigns,
  fetchDishOptions,
  previewCampaign,
  saveCampaign,
  sendCampaign,
  testCampaign,
} from "@/admin/lib/newsletter.actions";
import {
  BUTTON,
  Card,
  Confirm,
  EmailFrame,
  Empty,
  FIELD,
  GHOST,
  Loading,
  Pill,
  PRIMARY,
  SECONDARY,
  Toggle,
  unwrap,
} from "./parts";

const FILTERS: { id: CampaignFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "review", label: "To review" },
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "sending", label: "Sending" },
  { id: "sent", label: "Sent" },
];

export function CampaignsTab({
  onOpen,
  onNew,
  initialFilter = "all",
}: {
  onOpen: (id: string) => void;
  onNew: () => void;
  initialFilter?: CampaignFilter;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<CampaignFilter>(initialFilter);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<CampaignSummary | null>(null);
  const filters = { status: filter, page };

  const list = useQuery({
    queryKey: campaignsKey(filters),
    queryFn: () => unwrap(fetchCampaigns(filters)),
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data?.items.some((c) => c.status === "sending") ? 5_000 : 60_000,
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => unwrap(campaignAction(id, "duplicate")),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: NEWSLETTER_ROOT });
      toast.add({
        title: "Copy created",
        description: "It's a new draft: change what you like and send it.",
        type: "success",
      });
      onOpen(c.id);
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't duplicate it",
        description: e.message,
        type: "error",
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => unwrap(deleteCampaign(id)),
    onSuccess: () => {
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: NEWSLETTER_ROOT });
      toast.add({ title: "Newsletter deleted", type: "success" });
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't delete it",
        description: e.message,
        type: "error",
      }),
  });

  const counts = list.data?.counts;
  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div
        className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0"
        role="tablist"
        aria-label="Show"
      >
        {FILTERS.map((f) => {
          const n = counts ? counts[f.id] : undefined;
          if (f.id === "review" && !n) return null;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                filter === f.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
                f.id === "review" &&
                  filter !== f.id &&
                  "border-amber-500/40 bg-amber-500/[0.07] text-amber-800 dark:text-amber-300",
              )}
            >
              {f.id === "review" && <Sparkles className="size-3.5" />}
              {f.label}
              {n !== undefined && n > 0 && (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    filter === f.id ? "opacity-70" : "opacity-60",
                  )}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Card className="p-0 sm:p-0">
        {list.isPending ? (
          <Loading />
        ) : list.isError ? (
          <Empty
            icon={AlertTriangle}
            title="Couldn't load the newsletters"
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
            icon={Mail}
            title={filter === "all" ? "No newsletters yet" : "Nothing here"}
            text={
              filter === "all"
                ? "Write your first one: a new dish, an event, a weekend offer. Your subscribers are waiting."
                : "No newsletters with this status."
            }
            action={
              filter === "all" ? (
                <button type="button" onClick={onNew} className={PRIMARY}>
                  <Plus className="size-4" /> New newsletter
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((c) => (
              <li
                key={c.id}
                className="group flex items-center gap-2 pr-2 transition-colors hover:bg-muted/50 sm:pr-3"
              >
                <button
                  type="button"
                  onClick={() => onOpen(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3.5 text-left sm:px-5"
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl",
                      c.kind === "sale"
                        ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {c.kind === "sale" ? (
                      <Tag className="size-4.5" />
                    ) : (
                      <Mail className="size-4.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "truncate font-semibold",
                          !c.subject && "text-muted-foreground italic",
                        )}
                      >
                        {c.subject || "No subject"}
                      </span>
                      <Pill meta={CAMPAIGN_STATUS[c.status]} />
                      {c.needsReview && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                          <Sparkles className="size-3" /> To review
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {campaignLine(c)}
                    </span>
                    {(c.status === "sending" || c.status === "paused") && (
                      <Progress c={c} className="mt-2 max-w-sm" />
                    )}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-popup-open:bg-muted"
                    aria-label={`Actions for ${c.subject || "this newsletter"}`}
                  >
                    <MoreHorizontal className="size-4.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={6}
                    className="w-48 rounded-xl bg-card p-1.5 text-foreground shadow-lg"
                  >
                    <DropdownMenuItem
                      onClick={() => onOpen(c.id)}
                      className={MENU_ITEM}
                    >
                      {isEditable(c.status) ? (
                        <PencilLine className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                      {isEditable(c.status) ? "Edit" : "Open"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => duplicate.mutate(c.id)}
                      className={MENU_ITEM}
                    >
                      <Copy className="size-4" /> Duplicate
                    </DropdownMenuItem>
                    {c.status !== "sending" && (
                      <>
                        <DropdownMenuSeparator className="my-1" />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(c)}
                          className={MENU_ITEM}
                        >
                          <Trash2 className="size-4" /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
        {list.data && list.data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
            <span>
              Page {list.data.page} of {list.data.pages}
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
      </Card>

      <Confirm
        open={deleting !== null}
        title="Delete this newsletter?"
        text={
          deleting?.status === "sent"
            ? "It stays in your subscribers' inboxes; only the copy here is deleted."
            : "The draft is gone for good."
        }
        action="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

const MENU_ITEM =
  "cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground";

/** The grey line under a newsletter's subject */
export function campaignLine(c: CampaignSummary): string {
  switch (c.status) {
    case "sent":
      return `Sent ${formatDate(c.sentAt ?? c.updatedAt)} · ${c.stats.sent.toLocaleString()} delivered${c.stats.failed ? ` · ${c.stats.failed} failed` : ""}`;
    case "scheduled":
      return c.scheduledAt
        ? `Goes out ${formatDateTime(c.scheduledAt)}`
        : "Scheduled";
    case "sending":
      return `Sending: ${c.stats.sent.toLocaleString()} of ${c.stats.recipients.toLocaleString()}`;
    case "paused":
      return `Paused at ${c.stats.sent.toLocaleString()} of ${c.stats.recipients.toLocaleString()}`;
    case "cancelled":
      return `Stopped at ${c.stats.sent.toLocaleString()} of ${c.stats.recipients.toLocaleString()}`;
    default:
      return c.kind === "sale"
        ? `Prepared by the sale alert · ${formatDate(c.updatedAt)}`
        : `Edited ${formatDate(c.updatedAt)}${c.createdBy ? ` · ${c.createdBy}` : ""}`;
  }
}

function Progress({
  c,
  className,
}: {
  c: Pick<CampaignSummary, "stats" | "status">;
  className?: string;
}) {
  const pct = c.stats.recipients
    ? Math.min(
        100,
        Math.round(
          ((c.stats.sent + c.stats.failed) / c.stats.recipients) * 100,
        ),
      )
    : 0;
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-700",
            c.status === "paused" ? "bg-amber-500" : "bg-violet-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-xs font-semibold text-muted-foreground tabular-nums">
        {pct}%
      </span>
    </span>
  );
}

/* ═════════════ the side panel ═════════════ */

type SheetProps = {
  /** "new", an id, or null (closed) */
  open: string | null;
  onClose: () => void;
  onOpened: (id: string) => void;
  /** People who will get it */
  subscribers: number;
};

export function CampaignSheet({
  open,
  onClose,
  onOpened,
  subscribers,
}: SheetProps) {
  const id = open && open !== "new" ? open : null;
  const query = useQuery({
    queryKey: campaignKey(id ?? "none"),
    queryFn: () => unwrap(fetchCampaign(id!)),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data?.status === "sending" ? 4_000 : false,
  });

  return (
    <Sheet open={open !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full! max-w-none! flex-col gap-0 p-0 data-[side=right]:w-full! sm:w-[min(1200px,96vw)]! sm:max-w-[min(1200px,96vw)]! data-[side=right]:sm:max-w-[min(1200px,96vw)]!"
      >
        {open === "new" ? (
          <Editor
            key="new"
            campaign={null}
            onCreated={onOpened}
            onClose={onClose}
            subscribers={subscribers}
          />
        ) : !query.data ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Newsletter</SheetTitle>
              <SheetDescription>Loading the newsletter</SheetDescription>
            </SheetHeader>
            {query.isError ? (
              <Empty
                icon={AlertTriangle}
                title="Couldn't open it"
                text={query.error.message}
                action={
                  <button
                    type="button"
                    className={SECONDARY}
                    onClick={() => query.refetch()}
                  >
                    Try again
                  </button>
                }
              />
            ) : (
              <Loading className="flex-1" />
            )}
          </>
        ) : isEditable(query.data.status) ? (
          <Editor
            key={query.data.id}
            campaign={query.data}
            onCreated={onOpened}
            onClose={onClose}
            subscribers={subscribers}
          />
        ) : (
          <Report campaign={query.data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ───────────── writing ───────────── */

function Editor({
  campaign,
  onCreated,
  onClose,
  subscribers,
}: {
  campaign: AdminCampaign | null;
  onCreated: (id: string) => void;
  onClose: () => void;
  subscribers: number;
}) {
  const queryClient = useQueryClient();
  const saved = campaign ? draftOf(campaign) : EMPTY_DRAFT;
  const [draft, setDraft] = useState<CampaignDraft>(saved);
  const [view, setView] = useState<"write" | "preview">("write");
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = !sameDraft(draft, saved);
  const set = <K extends keyof CampaignDraft>(
    key: K,
    value: CampaignDraft[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  const buttonError =
    draft.button &&
    (draft.button.label.trim() === "" ||
      !LINK_PATTERN.test(draft.button.url.trim()))
      ? "Fill in the button text and a link like /menu or https://…"
      : null;

  // The preview follows the text, a moment after typing stops
  const [previewDraft, setPreviewDraft] = useState(draft);
  useEffect(() => {
    const t = setTimeout(() => setPreviewDraft(draft), 500);
    return () => clearTimeout(t);
  }, [draft]);
  const preview = useQuery({
    queryKey: ["admin-newsletter", "preview", previewDraft],
    queryFn: () => unwrap(previewCampaign(previewDraft)),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const updateCache = (c: AdminCampaign) => {
    queryClient.setQueryData(campaignKey(c.id), c);
    queryClient.invalidateQueries({
      queryKey: ["admin-newsletter", "campaigns"],
    });
    queryClient.invalidateQueries({ queryKey: ["admin-newsletter", "stats"] });
  };

  /** Saves if needed; returns the saved newsletter (null when it failed) */
  const save = useMutation({
    mutationFn: async (): Promise<AdminCampaign> => {
      if (!campaign) return unwrap(createCampaign(draft));
      return unwrap(saveCampaign(campaign.id, draft, campaign.version));
    },
    onSuccess: (c) => {
      updateCache(c);
      if (!campaign) onCreated(c.id);
    },
    onError: (e) => {
      toast.add({
        title: "Couldn't save",
        description: e.message,
        type: "error",
      });
      if (campaign)
        queryClient.invalidateQueries({ queryKey: campaignKey(campaign.id) });
    },
  });

  const ensureSaved = async (): Promise<AdminCampaign | null> => {
    if (buttonError) {
      toast.add({
        title: "Check the button",
        description: buttonError,
        type: "error",
      });
      return null;
    }
    if (campaign && !dirty) return campaign;
    try {
      return await save.mutateAsync();
    } catch {
      return null;
    }
  };

  const remove = useMutation({
    mutationFn: () => unwrap(deleteCampaign(campaign!.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NEWSLETTER_ROOT });
      toast.add({ title: "Draft deleted", type: "success" });
      onClose();
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't delete it",
        description: e.message,
        type: "error",
      }),
  });

  const unschedule = useMutation({
    mutationFn: () => unwrap(campaignAction(campaign!.id, "unschedule")),
    onSuccess: (c) => {
      updateCache(c);
      toast.add({
        title: "Back to draft",
        description: "It won't go out until you send or schedule it again.",
        type: "success",
      });
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't change it",
        description: e.message,
        type: "error",
      }),
  });

  return (
    <>
      <SheetHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pr-8">
          <SheetTitle className="min-w-0 truncate text-xl font-semibold tracking-tight">
            {draft.subject.trim() ||
              (campaign ? "Untitled newsletter" : "New newsletter")}
          </SheetTitle>
          {campaign && <Pill meta={CAMPAIGN_STATUS[campaign.status]} />}
          {campaign?.kind === "sale" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <Tag className="size-3" /> Sale alert
            </span>
          )}
        </div>
        <SheetDescription className="text-sm">
          {campaign?.status === "scheduled" && campaign.scheduledAt
            ? `Goes out ${formatDateTime(campaign.scheduledAt)} to everyone on the list. You can still change it until then.`
            : `Goes to ${subscribers.toLocaleString()} ${subscribers === 1 ? "subscriber" : "subscribers"}. Each email has its own unsubscribe link.`}
        </SheetDescription>
      </SheetHeader>

      {campaign?.needsReview && (
        <div className="flex items-start gap-3 border-b border-amber-500/25 bg-amber-500/8 px-5 py-3 text-sm sm:px-6">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>
            <span className="font-semibold">Prepared by the sale alert.</span>{" "}
            <span className="text-muted-foreground">
              A promotion just started: check the words and dishes, then send
              it.
            </span>
          </p>
        </div>
      )}

      {/* Phones: write or preview */}
      <div
        className="flex gap-1 border-b border-border p-2 lg:hidden"
        role="tablist"
      >
        {(["write", "preview"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "h-9 flex-1 rounded-lg text-sm font-semibold capitalize transition-colors",
              view === v
                ? "bg-foreground text-background"
                : "text-muted-foreground",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div
          className={cn(
            "min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6",
            view === "preview" && "hidden lg:block",
          )}
        >
          <Field
            label="Subject"
            hint="The line people see in their inbox"
            count={[draft.subject.length, 120]}
          >
            <input
              value={draft.subject}
              maxLength={120}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="Our autumn menu is here 🍂"
              className={cn(FIELD, "h-11 text-[15px] font-medium")}
            />
          </Field>
          <Field
            label="Preview text"
            hint="The grey line after the subject. Optional."
            count={[draft.preheader.length, 160]}
          >
            <input
              value={draft.preheader}
              maxLength={160}
              onChange={(e) => set("preheader", e.target.value)}
              placeholder="Six new dishes, and a table waiting for you"
              className={cn(FIELD, "h-11")}
            />
          </Field>
          <Field label="Title" hint="The big line at the top of the email">
            <input
              value={draft.heading}
              maxLength={120}
              onChange={(e) => set("heading", e.target.value)}
              placeholder="Autumn has arrived at our kitchen"
              className={cn(FIELD, "h-11")}
            />
          </Field>
          <BodyField value={draft.body} onChange={(v) => set("body", v)} />
          <ButtonField
            value={draft.button}
            error={buttonError}
            onChange={(v) => set("button", v)}
          />
          <DishesField
            value={draft.dishIds}
            onChange={(v) => set("dishIds", v)}
          />
        </div>

        <div
          className={cn(
            "min-h-0 overflow-y-auto border-border bg-muted/30 p-3 sm:p-5 lg:border-l",
            view === "write" && "hidden lg:block",
          )}
        >
          <EmailFrame
            html={preview.data?.html ?? null}
            subject={draft.subject}
            loading={preview.isFetching}
            className="min-h-full"
          />
          {preview.isError && (
            <p className="mt-2 text-sm text-destructive">
              {preview.error.message}
            </p>
          )}
        </div>
      </div>

      <footer className="flex items-center gap-2 border-t border-border bg-card px-3 py-3 sm:px-6">
        <span className="mr-auto hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          {save.isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </>
          ) : dirty ? (
            <>
              <span className="size-2 rounded-full bg-amber-500" /> Unsaved
              changes
            </>
          ) : campaign ? (
            <>
              <Check className="size-3.5 text-emerald-600" /> Saved
            </>
          ) : (
            "Not saved yet"
          )}
        </span>
        {campaign && (
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className={cn(GHOST, "mr-auto px-3 sm:mr-0")}
            aria-label="Delete draft"
          >
            <Trash2 className="size-4" />
          </button>
        )}
        {campaign?.status === "scheduled" && (
          <button
            type="button"
            onClick={() => unschedule.mutate()}
            disabled={unschedule.isPending}
            className={SECONDARY}
          >
            <XCircle className="size-4" /> Unschedule
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            if (await ensureSaved()) setTesting(true);
          }}
          className={SECONDARY}
        >
          <FlaskConical className="size-4" />{" "}
          <span className="sm:hidden">Test</span>
          <span className="hidden sm:inline">Send test</span>
        </button>
        <button
          type="button"
          onClick={() => ensureSaved()}
          disabled={!dirty || save.isPending}
          className={SECONDARY}
        >
          Save
        </button>
        <button
          type="button"
          onClick={async () => {
            if (await ensureSaved()) setSending(true);
          }}
          className={PRIMARY}
        >
          <Send className="size-4" />{" "}
          {campaign?.status === "scheduled" ? "Reschedule" : "Send…"}
        </button>
      </footer>

      {campaign && (
        <TestDialog
          open={testing}
          campaign={campaign}
          onClose={() => setTesting(false)}
        />
      )}
      {/* Mounted only while open: it reads the clock once, when it opens */}
      {campaign && sending && (
        <SendDialog
          open
          campaign={campaign}
          subscribers={subscribers}
          onClose={() => setSending(false)}
          onSent={(c) => updateCache(c)}
        />
      )}
      <Confirm
        open={deleting}
        title="Delete this draft?"
        text="It's gone for good. Nothing was sent."
        action="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setDeleting(false)}
      />
    </>
  );
}

function Field({
  label,
  hint,
  count,
  children,
}: {
  label: string;
  hint?: string;
  count?: [number, number];
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        {count && (
          <span
            className={cn(
              "text-xs tabular-nums",
              count[0] > count[1] * 0.9
                ? "text-amber-600"
                : "text-muted-foreground",
            )}
          >
            {count[1] - count[0]}
          </span>
        )}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

type Tool = "bold" | "link" | "list" | "heading";
const TOOLS: { id: Tool; label: string; icon: typeof Bold }[] = [
  { id: "bold", label: "Bold", icon: Bold },
  { id: "link", label: "Link", icon: Link2 },
  { id: "list", label: "List", icon: List },
  { id: "heading", label: "Sub-heading", icon: Heading2 },
];

/** The text, with buttons that add the little formatting marks */
function BodyField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = (before: string, after = before, placeholder = "text") => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const picked = value.slice(a, b) || placeholder;
    const next = value.slice(0, a) + before + picked + after + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        a + before.length,
        a + before.length + picked.length,
      );
    });
  };
  const prefixLines = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const end = value.indexOf("\n", el.selectionEnd);
    const stop = end === -1 ? value.length : end;
    const block = value.slice(start, stop) || "First point";
    const lines = block
      .split("\n")
      .map((l) => (l.startsWith(prefix) ? l : prefix + l));
    onChange(value.slice(0, start) + lines.join("\n") + value.slice(stop));
    requestAnimationFrame(() => el.focus());
  };

  const run = (tool: Tool) => {
    if (tool === "bold") wrap("**");
    else if (tool === "link") wrap("[", "](/menu)", "link text");
    else if (tool === "list") prefixLines("- ");
    else prefixLines("## ");
  };

  return (
    <div>
      <span className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">Message</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value.length.toLocaleString()} / 10,000
        </span>
      </span>
      <div className="overflow-hidden rounded-xl border border-border bg-background transition focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/15">
        <div className="flex gap-0.5 border-b border-border bg-muted/40 p-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              onClick={() => run(t.id)}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <t.icon className="size-4" />
            </button>
          ))}
        </div>
        <textarea
          ref={ref}
          value={value}
          maxLength={10_000}
          onChange={(e) => onChange(e.target.value)}
          rows={11}
          placeholder={
            "Hi there!\n\nThe nights are getting cooler, and our kitchen is warming up with six new dishes…\n\n- Slow-roasted lamb with pomegranate\n- Pumpkin kibbeh"
          }
          className="block min-h-56 w-full resize-y bg-transparent px-3.5 py-3 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        An empty line starts a new paragraph.{" "}
        <code className="rounded bg-muted px-1">**bold**</code> ·{" "}
        <code className="rounded bg-muted px-1">[link](/menu)</code> ·{" "}
        <code className="rounded bg-muted px-1">- list</code> ·{" "}
        <code className="rounded bg-muted px-1">## sub-heading</code>
      </p>
    </div>
  );
}

function ButtonField({
  value,
  error,
  onChange,
}: {
  value: CampaignDraft["button"];
  error: string | null;
  onChange: (v: CampaignDraft["button"]) => void;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Button</p>
          <p className="text-xs text-muted-foreground">
            A big link under the message: the menu, bookings, an event.
          </p>
        </div>
        <Toggle
          checked={!!value}
          onChange={(on) =>
            onChange(on ? { label: "See the menu", url: "/menu" } : null)
          }
          label="Add a button"
        />
      </div>
      {value && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr]">
          <input
            value={value.label}
            maxLength={40}
            onChange={(e) => onChange({ ...value, label: e.target.value })}
            placeholder="Book a table"
            aria-label="Button text"
            className={cn(FIELD, "h-10")}
          />
          <input
            value={value.url}
            maxLength={500}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
            placeholder="/reservations or https://…"
            aria-label="Button link"
            aria-invalid={!!error}
            className={cn(FIELD, "h-10")}
          />
          <div className="flex flex-wrap gap-1.5 sm:col-span-2">
            {[
              ["See the menu", "/menu"],
              ["Book a table", "/reservations"],
              ["Order online", "/menu"],
              ["Contact us", "/contact"],
            ].map(([label, url]) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange({ label, url })}
                className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>
          {error && (
            <p className="text-xs text-destructive sm:col-span-2">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Up to 6 dishes, shown as cards with today's price (and the sale price while a promotion runs) */
function DishesField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const dishes = useQuery({
    queryKey: DISHES_KEY,
    queryFn: () => unwrap(fetchDishOptions()),
    staleTime: 5 * 60_000,
  });
  const byId = useMemo(
    () => new Map((dishes.data ?? []).map((d) => [d.id, d])),
    [dishes.data],
  );
  const found = (dishes.data ?? []).filter((d) =>
    `${d.name} ${d.category}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const toggle = (id: string) =>
    onChange(
      value.includes(id)
        ? value.filter((v) => v !== id)
        : value.length >= MAX_DISHES
          ? value
          : [...value, id],
    );

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Featured dishes</p>
          <p className="text-xs text-muted-foreground">
            Photo, name and today&apos;s price. Up to {MAX_DISHES}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className={cn(SECONDARY, "h-9 px-3")}
        >
          <Plus className="size-4" /> {value.length ? "Change" : "Add dishes"}
        </button>
      </div>
      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {value.map((id) => {
            const d = byId.get(id);
            return (
              <li
                key={id}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/50 py-1 pr-1.5 pl-1 text-sm"
              >
                <DishThumb image={d?.image} />
                <span className="truncate">{d?.name ?? "Dish"}</span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${d?.name ?? "dish"}`}
                  className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border p-5">
            <DialogTitle>Featured dishes</DialogTitle>
            <DialogDescription>
              {value.length} of {MAX_DISHES} picked. Their prices are filled in
              when the email goes out.
            </DialogDescription>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes"
                className={cn(FIELD, "h-10 pl-9")}
                autoFocus
              />
            </div>
          </DialogHeader>
          <ul className="max-h-[55svh] divide-y divide-border overflow-y-auto">
            {dishes.isPending && <Loading />}
            {found.map((d) => {
              const on = value.includes(d.id);
              const full = !on && value.length >= MAX_DISHES;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    disabled={full}
                    onClick={() => toggle(d.id)}
                    className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-40"
                  >
                    <DishThumb image={d.image} size="lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {d.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {d.category}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-md border transition-colors",
                        on
                          ? "border-primary bg-primary text-white"
                          : "border-border",
                      )}
                    >
                      {on && <Check className="size-3.5" />}
                    </span>
                  </button>
                </li>
              );
            })}
            {!dishes.isPending && found.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                No dishes match.
              </p>
            )}
          </ul>
          <DialogFooter className="border-t border-border p-4">
            <button
              type="button"
              onClick={() => setPicking(false)}
              className={PRIMARY}
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DishThumb({
  image,
  size = "sm",
}: {
  image?: string;
  size?: "sm" | "lg";
}) {
  const box = size === "lg" ? "size-10 rounded-lg" : "size-6 rounded-full";
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={cn(box, "shrink-0 object-cover")} />
  ) : (
    <span
      className={cn(
        box,
        "grid shrink-0 place-items-center bg-card text-muted-foreground",
      )}
    >
      <UtensilsCrossed className="size-3" />
    </span>
  );
}

/* ───────────── test & send ───────────── */

function TestDialog({
  open,
  campaign,
  onClose,
}: {
  open: boolean;
  campaign: AdminCampaign;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const test = useMutation({
    mutationFn: () => unwrap(testCampaign(campaign.id, email)),
    onSuccess: ({ sentTo }) => {
      toast.add({
        title: "Test sent",
        description: `Check ${sentTo} in a minute (and the spam folder).`,
        type: "success",
      });
      onClose();
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't send the test",
        description: e.message,
        type: "error",
      }),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !test.isPending && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send a test</DialogTitle>
          <DialogDescription>
            See it in a real inbox before everyone does. The subject starts with
            [Test].
          </DialogDescription>
        </DialogHeader>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Send to</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your own email (leave empty)"
            className={cn(FIELD, "h-11")}
          />
        </label>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className={SECONDARY}
            disabled={test.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => test.mutate()}
            disabled={test.isPending}
            className={PRIMARY}
          >
            {test.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FlaskConical className="size-4" />
            )}{" "}
            Send test
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** datetime-local value for a Date, in the browser's time */
const localInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

function SendDialog({
  open,
  campaign,
  subscribers,
  onClose,
  onSent,
}: {
  open: boolean;
  campaign: AdminCampaign;
  subscribers: number;
  onClose: () => void;
  onSent: (c: AdminCampaign) => void;
}) {
  const [when, setWhen] = useState<"now" | "later">(
    campaign.status === "scheduled" ? "later" : "now",
  );
  // The moment the dialog opened (read once: render must not read the clock)
  const [openedAt] = useState(() => Date.now());
  const [at, setAt] = useState(() =>
    localInput(
      campaign.scheduledAt
        ? new Date(campaign.scheduledAt)
        : new Date(openedAt + 60 * 60_000),
    ),
  );
  const atDate = new Date(at);
  const tooSoon =
    when === "later" &&
    (Number.isNaN(atDate.getTime()) ||
      atDate.getTime() < openedAt + 2 * 60_000);

  const send = useMutation({
    mutationFn: () =>
      unwrap(
        sendCampaign(
          campaign.id,
          campaign.version,
          when === "later" ? atDate.toISOString() : undefined,
        ),
      ),
    onSuccess: (c) => {
      onSent(c);
      onClose();
      toast.add(
        when === "later"
          ? {
              title: "Scheduled",
              description: `It goes out ${formatDateTime(c.scheduledAt ?? atDate.toISOString())}.`,
              type: "success",
            }
          : {
              title: "On its way!",
              description: `Sending to ${subscribers.toLocaleString()} subscribers. You can follow it here.`,
              type: "success",
            },
      );
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't send it",
        description: e.message,
        type: "error",
      }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !send.isPending && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send “{campaign.subject}”</DialogTitle>
          <DialogDescription>
            To {subscribers.toLocaleString()}{" "}
            {subscribers === 1 ? "subscriber" : "subscribers"}. Once it starts
            going out, it can be paused but not taken back.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {(
            [
              ["now", Send, "Send now", "Starts within seconds, in batches"],
              [
                "later",
                CalendarClock,
                "Schedule",
                "Pick the moment it goes out",
              ],
            ] as const
          ).map(([id, Icon, title, text]) => (
            <label
              key={id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors",
                when === id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <input
                type="radio"
                name="when"
                checked={when === id}
                onChange={() => setWhen(id)}
                className="sr-only"
              />
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-lg",
                  when === id
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
          {when === "later" && (
            <div>
              <input
                type="datetime-local"
                value={at}
                min={localInput(new Date(openedAt))}
                onChange={(e) => setAt(e.target.value)}
                className={cn(FIELD, "h-11")}
                aria-invalid={tooSoon}
              />
              <p
                className={cn(
                  "mt-1.5 text-xs",
                  tooSoon ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {tooSoon
                  ? "Pick a time a few minutes from now or later."
                  : "In your own time zone. Tip: late morning and early evening get the most opens."}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className={SECONDARY}
            disabled={send.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => send.mutate()}
            disabled={send.isPending || tooSoon || subscribers === 0}
            className={PRIMARY}
          >
            {send.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : when === "later" ? (
              <CalendarClock className="size-4" />
            ) : (
              <Send className="size-4" />
            )}
            {when === "later"
              ? "Schedule"
              : `Send to ${subscribers.toLocaleString()}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── a newsletter that went out ───────────── */

function Report({ campaign: c }: { campaign: AdminCampaign }) {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const preview = useQuery({
    queryKey: ["admin-newsletter", "preview", c.id, c.version],
    queryFn: () => unwrap(previewCampaign(draftOf(c))),
    staleTime: Infinity,
  });

  const act = useMutation({
    mutationFn: (action: "pause" | "resume" | "cancel" | "duplicate") =>
      unwrap(campaignAction(c.id, action)),
    onSuccess: (next, action) => {
      setCancelling(false);
      queryClient.invalidateQueries({ queryKey: NEWSLETTER_ROOT });
      if (action !== "duplicate")
        queryClient.setQueryData(campaignKey(c.id), next);
      toast.add({
        title: {
          pause: "Paused",
          resume: "Sending again",
          cancel: "Stopped",
          duplicate: "Copy created in Drafts",
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

  const delivered = c.stats.recipients
    ? Math.round((c.stats.sent / c.stats.recipients) * 100)
    : 0;

  return (
    <>
      <SheetHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pr-8">
          <SheetTitle className="min-w-0 truncate text-xl font-semibold tracking-tight">
            {c.subject || "No subject"}
          </SheetTitle>
          <Pill meta={CAMPAIGN_STATUS[c.status]} />
        </div>
        <SheetDescription>{campaignLine(c)}</SheetDescription>
      </SheetHeader>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:overflow-hidden">
        <div className="space-y-4 p-5 sm:p-6 lg:overflow-y-auto">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Recipients", c.stats.recipients],
              ["Delivered", c.stats.sent],
              ["Failed", c.stats.failed],
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {(n as number).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          {(c.status === "sending" || c.status === "paused") && (
            <Progress c={c} />
          )}
          {c.status === "sent" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-emerald-600" /> {delivered}%
              delivered{c.sentAt && ` · finished ${formatDateTime(c.sentAt)}`}
            </p>
          )}
          {c.lastError && c.stats.failed > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span>
                <span className="font-semibold">
                  Last error from the mail server:
                </span>{" "}
                <span className="wrap-break-word text-muted-foreground">
                  {c.lastError}
                </span>
              </span>
            </p>
          )}
          <dl className="space-y-2 text-sm">
            {c.startedAt && (
              <Row label="Started">{formatDateTime(c.startedAt)}</Row>
            )}
            {c.sentBy && <Row label="Sent by">{c.sentBy}</Row>}
            {c.createdBy && <Row label="Written by">{c.createdBy}</Row>}
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            {c.status === "sending" && (
              <button
                type="button"
                onClick={() => act.mutate("pause")}
                disabled={act.isPending}
                className={SECONDARY}
              >
                <Pause className="size-4" /> Pause
              </button>
            )}
            {c.status === "paused" && (
              <button
                type="button"
                onClick={() => act.mutate("resume")}
                disabled={act.isPending}
                className={PRIMARY}
              >
                <Play className="size-4" /> Resume
              </button>
            )}
            {(c.status === "sending" || c.status === "paused") && (
              <button
                type="button"
                onClick={() => setCancelling(true)}
                disabled={act.isPending}
                className={cn(
                  BUTTON,
                  "text-destructive hover:bg-destructive/10",
                )}
              >
                <XCircle className="size-4" /> Stop for good
              </button>
            )}
            <button
              type="button"
              onClick={() => act.mutate("duplicate")}
              disabled={act.isPending}
              className={SECONDARY}
            >
              <Copy className="size-4" /> Duplicate
            </button>
          </div>
        </div>
        <div className="border-border bg-muted/30 p-3 sm:p-5 lg:overflow-y-auto lg:border-l">
          <EmailFrame
            html={preview.data?.html ?? null}
            subject={c.subject}
            loading={preview.isFetching}
          />
        </div>
      </div>

      <Confirm
        open={cancelling}
        title="Stop sending for good?"
        text={`${(c.stats.recipients - c.stats.sent - c.stats.failed).toLocaleString()} subscribers haven't got it yet and won't. To continue later instead, pause it.`}
        action="Stop sending"
        danger
        busy={act.isPending}
        onConfirm={() => act.mutate("cancel")}
        onClose={() => setCancelling(false)}
      />
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/70 pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
