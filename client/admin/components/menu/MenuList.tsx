import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RotateCw,
  SearchX,
  TriangleAlert,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAdminMenuItems } from "@/admin/lib/menu/api";
import { displayPrice, formatPrice } from "@/admin/lib/menu/format";
import {
  hasActiveFilters,
  menuHref,
  MENU_PAGE_PATH,
  MENU_PAGE_SIZE,
  pageWindow,
  type MenuFilters,
} from "@/admin/lib/menu/params";
import type {
  AdminMenuItem,
  MenuSummary,
  PaginationMeta,
} from "@/admin/lib/menu/types";
import {
  Badges,
  DietIcons,
  DishThumb,
  Highlight,
  StatusPill,
} from "./MenuClient";

type Props = {
  filters: MenuFilters;
  currency: string;
  canManage: boolean;
};

export const itemHref = (item: Pick<AdminMenuItem, "slug">) =>
  `${MENU_PAGE_PATH}/${item.slug}`;
export const editHref = (item: Pick<AdminMenuItem, "slug">) =>
  `${itemHref(item)}/edit`;

export async function MenuItemsList({ filters, currency, canManage }: Props) {
  const result = await fetchAdminMenuItems(filters);

  if (!result.ok) {
    return (
      <StateCard
        icon={<TriangleAlert className="size-6" />}
        tone="text-destructive bg-destructive/10"
        title="The menu didn't load"
        text={result.message}
        action={
          <Link
            href={menuHref(filters, { page: filters.page })}
            className={secondaryButton}
          >
            <RotateCw className="size-4" /> Try again
          </Link>
        }
      />
    );
  }

  const { items, meta } = result.data;

  if (items.length === 0 && meta.total > 0 && filters.page > meta.totalPages) {
    redirect(menuHref(filters, { page: meta.totalPages }));
  }

  if (items.length === 0) {
    if (filters.search) {
      return (
        <StateCard
          icon={<SearchX className="size-6" />}
          title={`Nothing matches “${filters.search}”`}
          text="Check the spelling, try fewer words, or search all categories."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {filters.category && (
                <Link
                  href={menuHref(filters, { category: "" })}
                  className={secondaryButton}
                >
                  Search all categories
                </Link>
              )}
              <Link
                href={menuHref(filters, { search: "" })}
                className={secondaryButton}
              >
                Clear search
              </Link>
            </div>
          }
        />
      );
    }
    if (hasActiveFilters(filters)) {
      return (
        <StateCard
          icon={<UtensilsCrossed className="size-6" />}
          title="No dishes here"
          text="Nothing fits these filters right now."
          action={
            <Link href={MENU_PAGE_PATH} className={secondaryButton}>
              Show all dishes
            </Link>
          }
        />
      );
    }
    return (
      <StateCard
        icon={<UtensilsCrossed className="size-6" />}
        tone="text-primary bg-primary/12"
        title="Your menu is empty"
        text="Add your first dish and it will show up here and on the website."
        action={
          canManage && (
            <Link href={`${MENU_PAGE_PATH}/new`} className={primaryButton}>
              <Plus className="size-4" /> New item
            </Link>
          )
        }
      />
    );
  }

  const first = (meta.page - 1) * meta.limit + 1;
  const last = first + items.length - 1;

  return (
    <section aria-label="Dishes">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {filters.search ? (
            <>
              <span className="font-semibold text-foreground tabular-nums">
                {meta.total}
              </span>{" "}
              {meta.total === 1 ? "result" : "results"} for{" "}
              <span className="font-medium text-foreground">
                “{filters.search}”
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground tabular-nums">
                {meta.total}
              </span>{" "}
              {meta.total === 1 ? "dish" : "dishes"}
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {first}–{last} of {meta.total}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <table className="hidden w-full text-sm lg:table">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <th scope="col" className="py-2.5 pr-3 pl-5 font-semibold">
                Dish
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Category
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Price
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Status
              </th>
              <th scope="col" className="w-14 py-2.5 pr-5 pl-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr
                key={item.id}
                className="group transition-colors hover:bg-muted/40"
              >
                <td className="py-3 pr-3 pl-5">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <DishThumb
                      image={item.image}
                      blur={item.imageBlur}
                      name={item.name}
                      className={cn(
                        "size-12",
                        !item.isVisible && "opacity-55 grayscale",
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <DishName item={item} search={filters.search} />
                        <DietIcons item={item} />
                        <Badges badges={item.badges} />
                      </div>
                      {item.description && (
                        <p className="mt-0.5 line-clamp-1 max-w-[52ch] text-[13px] text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <CategoryLabel item={item} filters={filters} />
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <Price item={item} currency={currency} />
                </td>
                <td className="px-3 py-3">
                  <StatusPill item={item} />
                </td>
                <td className="py-3 pr-5 pl-3 text-right">
                  {canManage && (
                    <Link
                      href={editHref(item)}
                      className="inline-grid size-9 place-items-center rounded-lg text-muted-foreground opacity-70 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 group-hover:opacity-100"
                    >
                      <Pencil className="size-4" />
                      <span className="sr-only">Edit {item.name}</span>
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-border lg:hidden">
          {items.map((item) => (
            <li
              key={item.id}
              className="relative flex gap-3.5 p-3.5 transition-colors has-[a.stretched:active]:bg-muted/60 sm:p-4"
            >
              <DishThumb
                image={item.image}
                blur={item.imageBlur}
                name={item.name}
                className={cn(
                  "size-16 sm:size-18",
                  !item.isVisible && "opacity-55 grayscale",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <DishName
                    item={item}
                    search={filters.search}
                    stretched
                    className="line-clamp-2"
                  />
                  <Price item={item} currency={currency} className="shrink-0" />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {!item.category.isActive && <EyeOff className="size-3" />}
                    {item.category.name}
                  </span>
                  <DietIcons item={item} />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <StatusPill item={item} />
                  <Badges badges={item.badges} />
                </div>
              </div>
              <ChevronRight
                className="mt-1 size-4 shrink-0 self-center text-muted-foreground/60"
                aria-hidden
              />
            </li>
          ))}
        </ul>
      </div>

      <MenuPagination filters={filters} meta={meta} />
    </section>
  );
}

function DishName({
  item,
  search,
  stretched,
  className,
}: {
  item: AdminMenuItem;
  search: string;
  stretched?: boolean;
  className?: string;
}) {
  const text = <Highlight text={item.name} search={search} />;
  const base = cn("font-semibold leading-snug text-foreground", className);
  return (
    <Link
      href={itemHref(item)}
      className={cn(
        base,
        "rounded-sm decoration-primary/40 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        stretched &&
          "stretched after:absolute after:inset-0 after:content-['']",
      )}
    >
      {text}
    </Link>
  );
}

function CategoryLabel({
  item,
  filters,
}: {
  item: AdminMenuItem;
  filters: MenuFilters;
}) {
  return (
    <Link
      href={menuHref(filters, { category: item.category.slug })}
      scroll={false}
      title={
        item.category.isActive
          ? `Only ${item.category.name}`
          : `${item.category.name} is hidden from guests`
      }
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
    >
      {!item.category.isActive && (
        <EyeOff className="size-3 text-muted-foreground" />
      )}
      {item.category.name}
    </Link>
  );
}

function Price({
  item,
  currency,
  className,
}: {
  item: AdminMenuItem;
  currency: string;
  className?: string;
}) {
  const { amount, from } = displayPrice(item);
  const onSale =
    item.variants.length === 0 &&
    item.compareAtPrice != null &&
    item.compareAtPrice > item.price;
  return (
    <div className={cn("text-right leading-tight", className)}>
      <p className="font-semibold tabular-nums">
        {from && (
          <span className="mr-1 text-xs font-normal text-muted-foreground">
            from
          </span>
        )}
        {formatPrice(amount, currency)}
      </p>
      {onSale ? (
        <p className="text-xs text-muted-foreground tabular-nums line-through">
          {formatPrice(item.compareAtPrice!, currency)}
        </p>
      ) : item.variants.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          {item.variants.length} sizes
        </p>
      ) : null}
    </div>
  );
}

const secondaryButton =
  "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";
const primaryButton =
  "inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function StateCard({
  icon,
  tone = "text-muted-foreground bg-muted",
  title,
  text,
  action,
}: {
  icon: ReactNode;
  tone?: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center sm:py-20">
      <span className={cn("grid size-14 place-items-center rounded-2xl", tone)}>
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

type Tile = {
  id: string;
  label: string;
  hint: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  changes: Pick<MenuFilters, "stock" | "visibility">;
};

export function MenuStats({
  totals,
  filters,
}: {
  totals: MenuSummary["totals"];
  filters: MenuFilters;
}) {
  const tiles: Tile[] = [
    {
      id: "all",
      label: "All dishes",
      hint: "Everything on file",
      value: totals.all,
      icon: UtensilsCrossed,
      tone: "bg-primary/12 text-primary ring-primary/40",
      changes: { stock: "all", visibility: "all" },
    },
    {
      id: "visible",
      label: "On the menu",
      hint: "Guests can see them",
      value: totals.visible,
      icon: Eye,
      tone: "bg-emerald-500/12 text-emerald-600 ring-emerald-500/40 dark:text-emerald-400",
      changes: { stock: "all", visibility: "visible" },
    },
    {
      id: "sold-out",
      label: "Sold out",
      hint: "Back when you say so",
      value: totals.soldOut,
      icon: CircleSlash,
      tone: "bg-amber-500/14 text-amber-600 ring-amber-500/40 dark:text-amber-400",
      changes: { stock: "sold-out", visibility: "all" },
    },
    {
      id: "hidden",
      label: "Hidden",
      hint: "Switched off for guests",
      value: totals.hidden,
      icon: EyeOff,
      tone: "bg-foreground/8 text-muted-foreground ring-foreground/25",
      changes: { stock: "all", visibility: "hidden" },
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {tiles.map((tile) => {
        const active =
          filters.stock === tile.changes.stock &&
          filters.visibility === tile.changes.visibility;
        const Icon = tile.icon;
        const ring = tile.tone.split(" ").find((c) => c.startsWith("ring-"));
        return (
          <Link
            key={tile.id}
            href={menuHref(filters, tile.changes)}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn(
              "group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-card p-3 transition-all",
              "sm:block sm:p-4 hover:-translate-y-0.5 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              active
                ? cn("border-transparent shadow-sm ring-2", ring)
                : "border-border",
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-2">
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-xl",
                  tile.tone,
                )}
              >
                <Icon className="size-4.5" />
              </span>
              {active && (
                <span className="hidden rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold tracking-wide text-background uppercase sm:inline">
                  Showing
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xl leading-tight font-semibold tracking-tight tabular-nums sm:mt-3 sm:text-[28px]">
                {tile.value}
              </p>
              <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm sm:text-foreground">
                {tile.label}
              </p>
              <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                {tile.hint}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function MenuPagination({
  filters,
  meta,
}: {
  filters: MenuFilters;
  meta: PaginationMeta;
}) {
  if (meta.totalPages <= 1) return null;
  const href = (page: number) => menuHref(filters, { page });

  return (
    <nav
      aria-label="Pages"
      className="mt-5 flex items-center justify-between gap-2 sm:justify-center"
    >
      <StepLink
        href={meta.hasPreviousPage ? href(meta.page - 1) : null}
        direction="previous"
      />

      <span className="text-sm text-muted-foreground tabular-nums sm:hidden">
        Page <span className="font-semibold text-foreground">{meta.page}</span>{" "}
        of {meta.totalPages}
      </span>

      <ol className="hidden items-center gap-1 sm:flex">
        {pageWindow(meta.page, meta.totalPages).map((page, index) =>
          page === "…" ? (
            <li
              key={`gap-${index}`}
              aria-hidden
              className="grid w-7 place-items-center text-muted-foreground"
            >
              …
            </li>
          ) : (
            <li key={page}>
              <Link
                href={href(page)}
                scroll={false}
                aria-current={page === meta.page ? "page" : undefined}
                aria-label={`Page ${page}`}
                className={cn(
                  "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-medium tabular-nums transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  page === meta.page
                    ? "bg-foreground text-background shadow-sm"
                    : "text-foreground/75 hover:bg-muted hover:text-foreground",
                )}
              >
                {page}
              </Link>
            </li>
          ),
        )}
      </ol>

      <StepLink
        href={meta.hasNextPage ? href(meta.page + 1) : null}
        direction="next"
      />
    </nav>
  );
}

function StepLink({
  href,
  direction,
}: {
  href: string | null;
  direction: "previous" | "next";
}) {
  const label = direction === "previous" ? "Previous" : "Next";
  const content = (
    <>
      {direction === "previous" && <ChevronLeft className="size-4" />}
      <span>{label}</span>
      {direction === "next" && <ChevronRight className="size-4" />}
    </>
  );
  const classes = cn(
    "inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium shadow-xs transition-colors",
    direction === "previous" ? "sm:mr-2" : "sm:ml-2",
  );

  if (!href) {
    return (
      <span
        aria-disabled
        className={cn(classes, "cursor-not-allowed opacity-45")}
      >
        {content}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      rel={direction === "previous" ? "prev" : "next"}
      className={cn(
        classes,
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
      )}
    >
      {content}
    </Link>
  );
}

const bar = "rounded-md bg-foreground/[0.07] animate-pulse";

export function MenuListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dishes">
      <div className="mb-3 flex justify-between px-1">
        <div className={`${bar} h-4 w-24`} />
        <div className={`${bar} h-3.5 w-16`} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="hidden h-10 border-b border-border bg-muted/50 lg:block" />
        <ul className="divide-y divide-border">
          {Array.from({ length: MENU_PAGE_SIZE }, (_, i) => (
            <li
              key={i}
              className="flex items-center gap-3.5 p-3.5 sm:p-4 lg:px-5 lg:py-3"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                className={`${bar} size-16 shrink-0 rounded-xl sm:size-18 lg:size-12`}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div
                  className={`${bar} h-4`}
                  style={{ width: `${45 + ((i * 17) % 35)}%` }}
                />
                <div className={`${bar} h-3 w-3/5 lg:w-2/5`} />
                <div className={`${bar} h-5 w-20 rounded-full lg:hidden`} />
              </div>
              <div className={`${bar} hidden h-6 w-20 lg:block`} />
              <div className={`${bar} h-4 w-14`} />
              <div className={`${bar} hidden h-6 w-24 rounded-full lg:block`} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
