"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Eye,
  Loader2,
  Mail,
  PartyPopper,
  Send,
  Sparkles,
  Tag,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AUTOMATIONS_KEY,
  CAMPAIGN_STATUS,
  formatDate,
  formatDateTime,
  NEWSLETTER_ROOT,
  type AutomationsView,
} from "@/admin/lib/newsletter";
import {
  fetchAutomations,
  previewSaleEmail,
  saveAutomations,
} from "@/admin/lib/newsletter.actions";
import {
  Card,
  EmailFrame,
  Empty,
  FIELD,
  Loading,
  Pill,
  PRIMARY,
  SECONDARY,
  Toggle,
  unwrap,
} from "./parts";

type Settings = Pick<AutomationsView, "welcome" | "sale">;

export function AutomationsTab({
  onOpenCampaign,
}: {
  onOpenCampaign: (id: string) => void;
}) {
  const query = useQuery({
    queryKey: AUTOMATIONS_KEY,
    queryFn: () => unwrap(fetchAutomations()),
    refetchInterval: 60_000,
  });
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <Card>
        <Empty
          icon={AlertTriangle}
          title="Couldn't load the automations"
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
      </Card>
    );
  return (
    <Form
      key={JSON.stringify({ w: query.data.welcome, s: query.data.sale })}
      view={query.data}
      onOpenCampaign={onOpenCampaign}
    />
  );
}

function Form({
  view,
  onOpenCampaign,
}: {
  view: AutomationsView;
  onOpenCampaign: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Settings>({
    welcome: view.welcome,
    sale: view.sale,
  });
  const [previewing, setPreviewing] = useState(false);
  const dirty =
    JSON.stringify(settings) !==
    JSON.stringify({ welcome: view.welcome, sale: view.sale });
  const welcome = settings.welcome;
  const sale = settings.sale;
  const setWelcome = (patch: Partial<Settings["welcome"]>) =>
    setSettings((s) => ({ ...s, welcome: { ...s.welcome, ...patch } }));
  const setSale = (patch: Partial<Settings["sale"]>) =>
    setSettings((s) => ({ ...s, sale: { ...s.sale, ...patch } }));

  const save = useMutation({
    mutationFn: () => unwrap(saveAutomations(settings)),
    onSuccess: (next) => {
      queryClient.setQueryData(AUTOMATIONS_KEY, next);
      queryClient.invalidateQueries({ queryKey: NEWSLETTER_ROOT });
      toast.add({
        title: "Automations saved",
        description:
          next.sale.enabled && !view.sale.enabled
            ? "From now on, new promotions are announced. Sales already running are left out."
            : undefined,
        type: "success",
      });
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't save",
        description: e.message,
        type: "error",
      }),
  });

  return (
    <div className="space-y-4 pb-20">
      <Card
        title="Welcome email"
        subtitle="Sent once, right after someone confirms their subscription"
        icon={PartyPopper}
        actions={
          <Toggle
            checked={welcome.enabled}
            onChange={(enabled) => setWelcome({ enabled })}
            label="Send the welcome email"
          />
        }
      >
        <div
          className={cn(
            "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]",
            !welcome.enabled && "opacity-60",
          )}
        >
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm font-semibold">Your message</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {1000 - welcome.message.length}
              </span>
            </span>
            <textarea
              value={welcome.message}
              maxLength={1000}
              rows={4}
              disabled={!welcome.enabled}
              onChange={(e) => setWelcome({ message: e.target.value })}
              placeholder={
                "Show this email on your next visit for a **free dessert** 🍰"
              }
              className={cn(FIELD, "resize-y py-3 leading-relaxed")}
            />
            <span className="mt-1.5 block text-xs text-muted-foreground">
              Optional. Shown in a highlighted box: a welcome offer works well.
              **bold** and [links](/menu) work.
            </span>
          </label>
          <div className="rounded-2xl bg-muted/50 p-4 text-sm">
            <p className="font-semibold">What they get</p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li className="flex gap-2">
                <span>🎉</span> “You&apos;re on the list”, and what to expect
                from you
              </li>
              {welcome.message.trim() && (
                <li className="flex gap-2">
                  <span>🎁</span> Your message, in a dashed box
                </li>
              )}
              <li className="flex gap-2">
                <span>🔗</span> A button to your website and a one-click
                unsubscribe
              </li>
            </ul>
          </div>
        </div>
      </Card>

      <Card
        title="Sale alert"
        subtitle="When a promotion starts on the menu, tell your subscribers"
        icon={Tag}
        actions={
          <Toggle
            checked={sale.enabled}
            onChange={(enabled) => setSale({ enabled })}
            label="Announce new promotions"
          />
        }
      >
        <ol className="grid gap-2 sm:grid-cols-3">
          {[
            ["A promotion starts", "Menu → Promotions, at its start time"],
            [
              "The email builds itself",
              "Its name, discount, dates and up to 6 dishes with sale prices",
            ],
            [
              sale.mode === "auto" ? "It goes out" : "You check and send",
              sale.mode === "auto"
                ? "To everyone on the list, right away"
                : "It waits in Newsletters → To review",
            ],
          ].map(([title, text], i) => (
            <li
              key={title}
              className="relative flex gap-3 rounded-xl border border-border p-3"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted-foreground">
                  {text}
                </span>
              </span>
              {i < 2 && (
                <ArrowRight className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-card text-muted-foreground sm:block" />
              )}
            </li>
          ))}
        </ol>

        <fieldset
          disabled={!sale.enabled}
          className={cn(
            "mt-5 min-w-0 space-y-5",
            !sale.enabled && "opacity-60",
          )}
        >
          <div>
            <legend className="mb-2 text-sm font-semibold">
              When a sale starts
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  [
                    "review",
                    Wand2,
                    "Prepare a draft for me",
                    "You read it, change it if you like, and press send. Recommended.",
                  ],
                  [
                    "auto",
                    Send,
                    "Send it automatically",
                    "No one has to do anything. Best when promotions are planned carefully.",
                  ],
                ] as const
              ).map(([id, Icon, title, text]) => (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors",
                    sale.mode === id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="sale-mode"
                    checked={sale.mode === id}
                    onChange={() => setSale({ mode: id })}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      sale.mode === id
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs text-pretty text-muted-foreground">
                      {text}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">
                Smallest discount to announce
              </span>
              <select
                value={sale.minPercent}
                onChange={(e) =>
                  setSale({ minPercent: Number(e.target.value) })
                }
                className={cn(FIELD, "h-11")}
              >
                {[5, 10, 15, 20, 25, 30, 40, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}% off or more
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">
                At most one sale email every
              </span>
              <select
                value={sale.cooldownDays}
                onChange={(e) =>
                  setSale({ cooldownDays: Number(e.target.value) })
                }
                className={cn(FIELD, "h-11")}
              >
                {[0, 1, 2, 3, 5, 7, 14, 30].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "No limit" : n === 1 ? "Day" : `${n} days`}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-xs text-muted-foreground">
                Promotions starting meanwhile wait, then go out together.
              </span>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              Opening lines
            </span>
            <textarea
              value={sale.intro}
              maxLength={1000}
              rows={3}
              onChange={(e) => setSale({ intro: e.target.value })}
              placeholder="Good news: some of your favourites are on sale right now."
              className={cn(FIELD, "resize-y py-3 leading-relaxed")}
            />
          </label>
        </fieldset>

        {view.sale.enabled && (
          <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4 text-primary" />
                  {view.pending.length
                    ? `${view.pending.length} ${view.pending.length === 1 ? "promotion" : "promotions"} to announce`
                    : "Nothing to announce right now"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {view.nextAllowedAt
                    ? `The next sale email can go out ${formatDateTime(view.nextAllowedAt)}.`
                    : view.pending.length
                      ? "It goes out within 5 minutes."
                      : "Checked every 5 minutes. Start a promotion in Menu → Promotions."}
                </p>
              </div>
              {view.pending.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPreviewing(true)}
                  className={SECONDARY}
                >
                  <Eye className="size-4" /> Preview the email
                </button>
              )}
            </div>
            {view.pending.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {view.pending.map((p) => (
                  <li
                    key={p.id}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm"
                  >
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      −{p.percentOff}%
                    </span>{" "}
                    {p.name}
                    {p.hours !== "All day" && (
                      <span className="text-xs text-muted-foreground">
                        · {p.hours}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {view.recent.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Recent sale emails
            </p>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {view.recent.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCampaign(c.id)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <Mail className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {c.subject}
                    </span>
                    {c.needsReview && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        To review
                      </span>
                    )}
                    <Pill meta={CAMPAIGN_STATUS[c.status]} />
                    <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">
                      {formatDate(c.sentAt ?? c.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Save bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-4 z-30 mx-auto flex w-[min(560px,calc(100%-2rem))] items-center gap-3 rounded-2xl border border-border bg-card/95 p-2.5 pl-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,.45)] backdrop-blur transition-all duration-300",
          dirty
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0",
        )}
        aria-hidden={!dirty}
      >
        <Clock className="size-4 text-amber-500" />
        <span className="flex-1 text-sm font-medium">Unsaved changes</span>
        <button
          type="button"
          onClick={() =>
            setSettings({ welcome: view.welcome, sale: view.sale })
          }
          className={SECONDARY}
          disabled={save.isPending}
          tabIndex={dirty ? 0 : -1}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => save.mutate()}
          className={PRIMARY}
          disabled={save.isPending}
          tabIndex={dirty ? 0 : -1}
        >
          {save.isPending && <Loader2 className="size-4 animate-spin" />} Save
        </button>
      </div>

      <SalePreview open={previewing} onClose={() => setPreviewing(false)} />
    </div>
  );
}

function SalePreview({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const preview = useQuery({
    queryKey: ["admin-newsletter", "sale-preview"],
    queryFn: () => unwrap(previewSaleEmail()),
    enabled: open,
    staleTime: 30_000,
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] gap-0! overflow-hidden p-0! sm:max-w-3xl!">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle>The next sale email</DialogTitle>
          <DialogDescription>
            Built from the promotions running now. Prices are worked out again
            when it goes out.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[75svh] overflow-y-auto p-4">
          {preview.isError ? (
            <p className="p-6 text-center text-sm text-destructive">
              {preview.error.message}
            </p>
          ) : preview.data === null ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No promotion is waiting to be announced.
            </p>
          ) : (
            <EmailFrame
              html={preview.data?.html ?? null}
              subject={preview.data?.subject}
              loading={preview.isFetching}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
