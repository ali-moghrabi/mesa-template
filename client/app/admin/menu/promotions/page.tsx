import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Clock,
  Percent,
  Plus,
  Sparkles,
  Store,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { cn } from "@/lib/utils";
import { adminFetch } from "@/admin/lib/menu/api";
import { MENU_PAGE_PATH } from "@/admin/lib/menu/params";
import {
  PRESETS,
  PROMOTIONS_PATH,
  scheduleLabel,
  statusInfo,
  type AdminPromotion,
  type PresetKey,
  type PromotionCatalog,
} from "@/admin/lib/promotions";
import {
  PromotionActions,
  StatusPill,
} from "@/admin/components/promotions/PromotionsClient";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Promotions | ${brand.name} Admin` };
}
export default async function PromotionsPage() {
  await requireTeam("menu:manage");
  const [list, catalog] = await Promise.all([
    adminFetch<AdminPromotion[]>("/admin/menu/promotions"),
    adminFetch<PromotionCatalog>("/admin/menu/promotions/catalog"),
  ]);
  const categoryNames = new Map(
    (catalog.ok ? catalog.data.categories : []).map((c) => [c.id, c.name]),
  );
  const now = new Date();

  const promotions = list.ok ? list.data : [];
  const groups: { title: string; hint: string; items: AdminPromotion[] }[] = [
    {
      title: "Running now",
      hint: "Guests see these prices",
      items: promotions.filter((p) => p.status.state === "running"),
    },
    {
      title: "Coming up",
      hint: "Scheduled, or waiting for their hours",
      items: promotions.filter(
        (p) => p.status.state === "scheduled" || p.status.state === "waiting",
      ),
    },
    {
      title: "Paused",
      hint: "Never apply until switched back on",
      items: promotions.filter((p) => p.status.state === "paused"),
    },
  ];
  const ended = promotions.filter((p) => p.status.state === "ended");
  const running = groups[0].items.length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
      <header className="flex flex-col gap-4 pt-6 pb-6 sm:flex-row sm:items-end sm:justify-between lg:pt-10">
        <div className="min-w-0">
          <Link
            href={MENU_PAGE_PATH}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Menu
          </Link>
          <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
            Promotions
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-[15px]">
            {running > 0
              ? `${running} running right now. Dish prices stay as they are: the sale price is worked out live.`
              : "Discounts on the whole menu, some categories or a few dishes, now or on a schedule."}
          </p>
        </div>
        {promotions.length > 0 && <NewButton />}
      </header>

      {!list.ok ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">The promotions didn&apos;t load</p>
            <p className="mt-0.5 text-sm">{list.message}</p>
          </div>
        </div>
      ) : promotions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {groups
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <section key={group.title} aria-label={group.title}>
                <div className="mb-3 flex items-baseline gap-2 px-1">
                  <h2 className="text-sm font-semibold">{group.title}</h2>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length} · {group.hint}
                  </span>
                </div>
                <ul className="grid gap-3 lg:grid-cols-2">
                  {group.items.map((promotion) => (
                    <PromotionCard
                      key={promotion.id}
                      promotion={promotion}
                      categoryNames={categoryNames}
                      now={now}
                    />
                  ))}
                </ul>
              </section>
            ))}

          {ended.length > 0 && (
            <details className="group/ended">
              <summary className="mb-3 inline-flex cursor-pointer list-none items-baseline gap-2 rounded-md px-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
                Ended{" "}
                <span className="text-xs font-normal">
                  {ended.length} · show
                </span>
              </summary>
              <ul className="grid gap-3 opacity-75 lg:grid-cols-2">
                {ended.map((promotion) => (
                  <PromotionCard
                    key={promotion.id}
                    promotion={promotion}
                    categoryNames={categoryNames}
                    now={now}
                  />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function PromotionCard({
  promotion,
  categoryNames,
  now,
}: {
  promotion: AdminPromotion;
  categoryNames: Map<string, string>;
  now: Date;
}) {
  const status = statusInfo(promotion.status, promotion.timezone, now);
  const live = status.tone === "live";
  const names = promotion.categoryIds
    .map((id) => categoryNames.get(id))
    .filter(Boolean) as string[];
  const scope =
    promotion.scope === "menu"
      ? "Whole menu"
      : promotion.scope === "categories"
        ? names.length > 2
          ? `${names.slice(0, 2).join(", ")} +${names.length - 2}`
          : names.join(", ") || "Categories"
        : `${promotion.dishIds.length} ${promotion.dishIds.length === 1 ? "dish" : "dishes"}`;

  return (
    <li className="group relative rounded-2xl border border-border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`${PROMOTIONS_PATH}/${promotion.id}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label={`Edit ${promotion.name}`}
      />
      <div className="flex items-start gap-4 p-4">
        <div
          className={cn(
            "relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl text-lg font-bold tracking-tight tabular-nums",
            live
              ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_color-mix(in_srgb,var(--primary)_80%,transparent)]"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span
            aria-hidden
            className="absolute -top-4 -right-4 size-10 rounded-full bg-white/10"
          />
          −{promotion.percentOff}%
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate font-semibold">{promotion.name}</h3>
            <StatusPill {...status} />
          </div>
          <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
            <Detail icon={<Store className="size-3.5" />}>
              {scope}
              {promotion.excludedDishIds.length > 0 &&
                ` · except ${promotion.excludedDishIds.length}`}
              {promotion.scope !== "dishes" && (
                <span className="text-muted-foreground/70">
                  {" "}
                  · {promotion.affectedCount}{" "}
                  {promotion.affectedCount === 1 ? "dish" : "dishes"}
                </span>
              )}
            </Detail>
            <Detail icon={<Clock className="size-3.5" />}>
              {scheduleLabel(promotion)}
            </Detail>
          </ul>
        </div>
        <QueryWrapper>
          <PromotionActions promotion={promotion} />
        </QueryWrapper>
      </div>
    </li>
  );
}

const Detail = ({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) => (
  <li className="flex min-w-0 items-center gap-1.5">
    <span className="shrink-0">{icon}</span>
    <span className="truncate">{children}</span>
  </li>
);

function NewButton({ className }: { className?: string }) {
  return (
    <Link
      href={`${PROMOTIONS_PATH}/new`}
      className={cn(
        "group inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition hover:-translate-y-px hover:brightness-110",
        className,
      )}
    >
      <Plus className="size-4.5 transition-transform group-hover:rotate-90" />
      New promotion
    </Link>
  );
}

function EmptyState() {
  const icons: Record<PresetKey, ReactNode> = {
    "happy-hour": <Clock className="size-5" />,
    "weekend-brunch": <Sparkles className="size-5" />,
    "menu-sale": <UtensilsCrossed className="size-5" />,
  };
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-xs sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_60%)]"
      />
      <div className="relative">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--primary)_80%,transparent)]">
          <Percent className="size-7" />
        </span>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">
          Run your first promotion
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          The menu shows the discount with a badge and the old price crossed
          out, and goes back to normal on its own when it ends.
        </p>
        <ul className="mx-auto mt-7 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
            <li key={key}>
              <Link
                href={`${PROMOTIONS_PATH}/new?preset=${key}`}
                className="group flex h-full flex-col rounded-2xl border border-border bg-background/70 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
                  {icons[key]}
                </span>
                <span className="mt-3 font-semibold">{PRESETS[key].title}</span>
                <span className="mt-0.5 text-sm text-muted-foreground">
                  {PRESETS[key].text}
                </span>
                <span className="mt-3 text-sm font-semibold text-primary">
                  Start from this →
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <NewButton />
        </div>
      </div>
    </div>
  );
}
