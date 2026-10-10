import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, LayoutGrid, Plus } from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/auth/user-roles";
import { fetchMenuSummary } from "@/admin/lib/menu/api";
import { MENU_PAGE_PATH, parseMenuFilters } from "@/admin/lib/menu/params";
import type { MenuSummary } from "@/admin/lib/menu/types";
import {
  MenuItemsList,
  MenuListSkeleton,
  MenuStats,
} from "@/admin/components/menu/MenuList";
import { MenuToolbar } from "@/admin/components/menu/MenuClient";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Menu | ${brand.name} Admin` };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const EMPTY_SUMMARY: MenuSummary = {
  totals: { all: 0, visible: 0, hidden: 0, soldOut: 0 },
  categories: [],
};

export default async function AdminMenuPage({ searchParams }: Props) {
  const user = await requireTeam("menu:availability");
  const canManage = hasPermission(user.role, "menu:manage");
  const config = getConfig();
  const filters = parseMenuFilters(await searchParams);

  const summaryResult = await fetchMenuSummary();
  const summary = summaryResult.ok ? summaryResult.data : EMPTY_SUMMARY;
  const { totals, categories } = summary;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
      <header className="flex flex-col gap-4 pt-6 pb-5 sm:flex-row sm:items-end sm:justify-between lg:pt-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Restaurant
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
            Menu
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-[15px]">
            {totals.all === 0
              ? "Every dish you add shows up here and on the website."
              : `${totals.all} ${totals.all === 1 ? "dish" : "dishes"} in ${categories.length} ${categories.length === 1 ? "category" : "categories"}${
                  totals.soldOut ? ` · ${totals.soldOut} sold out` : ""
                }`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`${MENU_PAGE_PATH}/categories`}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <LayoutGrid className="size-4" />
            Categories
            <span className="hidden rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums sm:inline">
              {categories.length}
            </span>
          </Link>
          <a
            href="/menu"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <ExternalLink className="size-4" />
            <span className="sr-only sm:not-sr-only">View on site</span>
          </a>
          {canManage && (
            <Link
              href={`${MENU_PAGE_PATH}/new${filters.category ? `?category=${filters.category}` : ""}`}
              className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary whitespace-nowrap px-4 text-sm font-semibold text-primary-foreground shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 sm:flex-none"
            >
              <Plus className="size-4.5 transition-transform group-hover:rotate-90" />
              New item
            </Link>
          )}
        </div>
      </header>

      {!summaryResult.ok && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {summaryResult.message}
        </p>
      )}

      <MenuStats totals={totals} filters={filters} />

      <div className="mt-5">
        <MenuToolbar
          filters={filters}
          categories={categories}
          totalCount={totals.all}
        />
      </div>

      <div className="mt-5">
        <Suspense key={JSON.stringify(filters)} fallback={<MenuListSkeleton />}>
          <MenuItemsList
            filters={filters}
            currency={config.menu.currency.primary.code}
            canManage={canManage}
          />
        </Suspense>
      </div>
    </div>
  );
}
