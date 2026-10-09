import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  TriangleAlert,
  ChevronRight,
  EyeOff,
  Pencil,
  Plus,
  RotateCw,
  SearchX,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAdminMenuItems } from "@/admin/lib/menu/api";
import { displayPrice, formatPrice } from "@/admin/lib/menu/format";
import {
  hasActiveFilters,
  menuHref,
  MENU_PAGE_PATH,
  type MenuFilters,
} from "@/admin/lib/menu/params";
import type { AdminMenuItem } from "@/admin/lib/menu/types";
import { DishThumb } from "./DishThumb";
import { Badges, DietIcons, Highlight, StatusPill } from "./MenuItemParts";
import { MenuPagination } from "./MenuPagination";

type Props = {
  filters: MenuFilters;
  currency: string;
  canManage: boolean;
};

export const editHref = (item: Pick<AdminMenuItem, "slug">) =>
  `${MENU_PAGE_PATH}/${item.slug}`;

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
                      name={item.name}
                      className={cn(
                        "size-12",
                        !item.isVisible && "opacity-55 grayscale",
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <DishName
                          item={item}
                          search={filters.search}
                          canManage={canManage}
                        />
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
                    canManage={canManage}
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
              {canManage && (
                <ChevronRight
                  className="mt-1 size-4 shrink-0 self-center text-muted-foreground/60"
                  aria-hidden
                />
              )}
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
  canManage,
  stretched,
  className,
}: {
  item: AdminMenuItem;
  search: string;
  canManage: boolean;
  /** The link covers the whole card (phones) */
  stretched?: boolean;
  className?: string;
}) {
  const text = <Highlight text={item.name} search={search} />;
  const base = cn("font-semibold leading-snug text-foreground", className);
  if (!canManage) return <span className={base}>{text}</span>;
  return (
    <Link
      href={editHref(item)}
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
      {action && <div className="mt-5 text-white">{action}</div>}
    </div>
  );
}
