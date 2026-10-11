import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Clock,
  EyeOff,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/auth/user-roles";
import { cn } from "@/lib/utils";
import { fetchAdminCategories } from "@/admin/lib/menu/api";
import { servingLabel } from "@/admin/lib/menu/category-schema";
import {
  DEFAULT_FILTERS,
  MENU_PAGE_PATH,
  menuHref,
} from "@/admin/lib/menu/params";
import type { AdminMenuCategory } from "@/admin/lib/menu/types";
import {
  CategorySelection,
  DishThumb,
  SelectCardOverlay,
  SelectToggle,
} from "@/admin/components/menu/MenuClient";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Categories | ${brand.name} Admin` };
}

const CATEGORIES_PATH = `${MENU_PAGE_PATH}/categories`;
const STARTERS = ["Starters", "Mains", "Desserts", "Drinks"];

export default async function MenuCategoriesPage() {
  const user = await requireTeam("menu:availability");
  const canManage = hasPermission(user.role, "menu:manage");
  const result = await fetchAdminCategories();
  const categories = result.ok ? result.data : [];

  const hidden = categories.filter((c) => !c.isActive).length;
  const dishes = categories.reduce((sum, c) => sum + c.itemCount, 0);

  const page = (
    <>
      <header className="flex flex-col gap-4 pt-6 pb-6 sm:flex-row sm:items-end sm:justify-between lg:pt-10">
        <div className="min-w-0">
          <Link
            href={MENU_PAGE_PATH}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Menu
          </Link>
          <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
            Categories
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-[15px]">
            {categories.length === 0
              ? "The sections of your menu: Starters, Mains, Drinks…"
              : `${categories.length} ${categories.length === 1 ? "category" : "categories"} · ${dishes} ${dishes === 1 ? "dish" : "dishes"}${
                  hidden ? ` · ${hidden} hidden` : ""
                }. Guests see them in this order.`}
          </p>
        </div>
        {canManage && categories.length > 0 && (
          <div className="flex gap-2">
            <SelectToggle className="h-10 flex-1 rounded-xl border border-border bg-card px-3.5 text-sm shadow-xs sm:flex-none" />
            <NewCategoryButton />
          </div>
        )}
      </header>

      {!result.ok ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">The categories didn&apos;t load</p>
            <p className="mt-0.5 text-sm">{result.message}</p>
          </div>
        </div>
      ) : categories.length === 0 ? (
        <EmptyState canManage={canManage} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category, index) => (
            <li key={category.id} className="relative">
              <CategoryCard category={category} position={index + 1} />
              <SelectCardOverlay
                id={category.id}
                name={category.name}
                corner="end"
                className="rounded-2xl"
              />
            </li>
          ))}
          {canManage && (
            <li className="group-data-[selecting=true]/select:hidden">
              <Link
                href={`${CATEGORIES_PATH}/new`}
                className="group flex h-full min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                  <Plus className="size-6 transition-transform group-hover:rotate-90" />
                </span>
                <span className="font-semibold">Add a category</span>
                <span className="max-w-56 text-sm text-muted-foreground">
                  Breakfast, Specials, Kids menu…
                </span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
      {canManage && categories.length > 0 ? (
        <QueryWrapper>
          <CategorySelection
            key={categories.map((c) => c.id).join()}
            categories={categories.map(
              ({ id, name, image, imageBlur, isActive, itemCount }) => ({
                id,
                name,
                image,
                imageBlur,
                isActive,
                itemCount,
              }),
            )}
          >
            {page}
          </CategorySelection>
        </QueryWrapper>
      ) : (
        page
      )}
    </div>
  );
}

function CategoryCard({
  category,
  position,
}: {
  category: AdminMenuCategory;
  position: number;
}) {
  const { itemCount, soldOutCount } = category;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-video overflow-hidden">
        {category.image ? (
          <DishThumb
            image={category.image}
            blur={category.imageBlur}
            name={category.name}
            sizes="(min-width: 1280px) 360px, (min-width: 640px) 50vw, 100vw"
            className={cn(
              "absolute inset-0 size-full rounded-none ring-0 transition-transform duration-500 group-hover:scale-[1.03]",
              !category.isActive && "grayscale",
            )}
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_20%_15%,color-mix(in_srgb,var(--primary)_32%,transparent),transparent_60%),radial-gradient(circle_at_85%_90%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_55%)] bg-muted"
          >
            <span className="text-7xl font-bold tracking-tight text-primary/25 select-none">
              {category.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/15 to-transparent" />

        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums backdrop-blur">
            #{position}
          </span>
          {!category.isActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-neutral-900">
              <EyeOff className="size-3" /> Hidden
            </span>
          )}
        </div>

        <div className="absolute inset-x-4 bottom-3">
          <h2 className="truncate text-lg leading-tight font-semibold text-white">
            {category.name}
          </h2>
          <p className="text-[13px] text-white/80 tabular-nums">
            {itemCount === 0
              ? "No dishes yet"
              : `${itemCount} ${itemCount === 1 ? "dish" : "dishes"}`}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <p
          className={cn(
            "line-clamp-2 text-sm",
            category.description
              ? "text-muted-foreground"
              : "text-muted-foreground/60 italic",
          )}
        >
          {category.description || "No description"}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {category.servingHours.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" /> Whenever you&apos;re open
            </span>
          ) : (
            category.servingHours.map((window, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary tabular-nums"
              >
                <Clock className="size-3.5" /> {servingLabel(window)}
              </span>
            ))
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",
                soldOutCount
                  ? "bg-amber-500"
                  : itemCount
                    ? "bg-emerald-500"
                    : "bg-foreground/25",
              )}
            />
            {soldOutCount
              ? `${soldOutCount} sold out`
              : itemCount
                ? "All in stock"
                : "Empty"}
          </span>
          <Link
            href={menuHref(DEFAULT_FILTERS, { category: category.slug })}
            className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            View dishes{" "}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ canManage }: { canManage: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center shadow-xs sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_60%)]"
      />
      <div className="relative">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary">
          <ChefHat className="size-7" />
        </span>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">
          Start with your first category
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Categories are the sections of your menu. Every dish belongs to one,
          so create them before adding dishes.
        </p>
        {canManage ? (
          <>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {STARTERS.map((name) => (
                <Link
                  key={name}
                  href={`${CATEGORIES_PATH}/new?name=${encodeURIComponent(name)}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                >
                  <Plus className="size-3.5" /> {name}
                </Link>
              ))}
            </div>
            <div className="mt-5">
              <NewCategoryButton />
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Ask a manager to add the categories.
          </p>
        )}
      </div>
    </div>
  );
}

function NewCategoryButton() {
  return (
    <Link
      href={`${CATEGORIES_PATH}/new`}
      className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 sm:flex-none text-sm font-semibold text-white shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Plus className="size-4.5 transition-transform group-hover:rotate-90" />
      New category
    </Link>
  );
}
