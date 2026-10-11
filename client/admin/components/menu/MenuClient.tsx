"use client";

/**
 * The menu's interactive pieces (search bar, photo with fallback) and the small labels shared by
 * the list and the dish form. One client file: server components can render all of them.
 */

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  Clock,
  EyeOff,
  Flame,
  Leaf,
  ListChecks,
  ListOrdered,
  LoaderCircle,
  Minus,
  Search,
  Sparkles,
  Star,
  Trash2,
  WheatOff,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  deleteMenuCategories,
  deleteMenuItems,
} from "@/admin/lib/menu/actions";
import type { ApiResult } from "@/admin/lib/menu/api";
import { cn } from "@/lib/utils";
import { whenLabel } from "@/lib/promotions";
import { canOptimize, mediaSrc, tagLabel } from "@/admin/lib/menu/format";
import {
  cleanSearch,
  hasActiveFilters,
  menuHref,
  SORT_OPTIONS,
  type MenuFilters,
  MENU_PAGE_PATH,
  type MenuSortValue,
} from "@/admin/lib/menu/params";
import type {
  AdminMenuCategory,
  AdminMenuItem,
  DishSale,
  MenuSummary,
} from "@/admin/lib/menu/types";

const SEARCH_DELAY_MS = 300;

const DEFAULT_SORT = "default";

const SORT_ICONS: Record<MenuSortValue, LucideIcon> = {
  "": ListOrdered,
  relevance: Sparkles,
  name: ArrowDownAZ,
  price: ArrowUpNarrowWide,
  "-price": ArrowDownWideNarrow,
  newest: Clock,
};

function sortDisplay(
  value: MenuSortValue,
  searching: boolean,
): { label: string; Icon: LucideIcon } {
  if (value === "" && searching) return { label: "Best match", Icon: Sparkles };
  return {
    label: SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Menu order",
    Icon: SORT_ICONS[value],
  };
}

type Props = {
  filters: MenuFilters;
  categories: MenuSummary["categories"];
  totalCount: number;
};

export function MenuToolbar({ filters, categories, totalCount }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [draft, setDraft] = useState(filters.search);
  const [sent, setSent] = useState(filters.search);
  const [seen, setSeen] = useState(filters.search);

  if (filters.search !== seen) {
    setSeen(filters.search);
    if (filters.search !== sent) {
      setDraft(filters.search);
      setSent(filters.search);
    }
  }

  const go = (href: string, replace = false) =>
    startTransition(() =>
      replace
        ? router.replace(href, { scroll: false })
        : router.push(href, { scroll: false }),
    );

  const submit = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    const search = cleanSearch(value);
    if (search === cleanSearch(sent)) return;
    setSent(search);
    go(menuHref(filters, { search }), true);
  };

  const onType = (value: string) => {
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => submit(value), SEARCH_DELAY_MS);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']"))
        return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const searching = filters.search !== "";
  const sort: MenuSortValue =
    searching && filters.sort === "relevance" ? "" : filters.sort;
  const sortOptions = SORT_OPTIONS.filter(
    (o) => o.value !== "relevance" || sort === "relevance",
  );

  return (
    <div className="z-20 -mx-4 border-b border-border bg-background/85 px-4 pt-3 pb-3 backdrop-blur-md sm:sticky sm:top-14 sm:-mx-8 sm:px-8 lg:top-0">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <form
          role="search"
          className="group relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
        >
          <label htmlFor="menu-search" className="sr-only">
            Search dishes
          </label>
          <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-muted-foreground transition-colors group-focus-within:text-primary">
            {isPending ? (
              <LoaderCircle className="size-4.5 animate-spin" />
            ) : (
              <Search className="size-4.5" />
            )}
          </span>
          <input
            ref={inputRef}
            id="menu-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={80}
            value={draft}
            onChange={(event) => onType(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && draft) {
                event.preventDefault();
                setDraft("");
                submit("");
              }
            }}
            placeholder="Search the menu…"
            className={cn(
              "h-11 w-full rounded-xl border border-border bg-card pr-20 pl-11 text-[15px] shadow-xs outline-none transition",
              "placeholder:text-muted-foreground/80 hover:border-foreground/20",
              "focus:border-primary/60 focus:ring-4 focus:ring-primary/15",
              "[&::-webkit-search-cancel-button]:appearance-none",
            )}
          />
          <span className="absolute inset-y-0 right-2 flex items-center gap-1">
            {draft ? (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  submit("");
                  inputRef.current?.focus();
                }}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <X className="size-4" />
                <span className="sr-only">Clear search</span>
              </button>
            ) : (
              <kbd className="pointer-events-none mr-1.5 hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground sm:block">
                /
              </kbd>
            )}
          </span>
        </form>

        <Select
          value={sort || DEFAULT_SORT}
          onValueChange={(value) => {
            if (value == null) return;
            const next = (value === DEFAULT_SORT ? "" : value) as MenuSortValue;
            if (next !== sort) go(menuHref(filters, { sort: next }));
          }}
        >
          <SelectTrigger
            aria-label="Sort dishes"
            className={cn(
              "h-11 w-full cursor-pointer gap-2.5 rounded-xl border-border bg-card pr-3 pl-3.5 text-sm font-medium shadow-xs transition sm:w-56",
              "data-[size=default]:h-11 hover:border-foreground/20 dark:bg-card dark:hover:bg-card",
              "focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15 data-popup-open:border-primary/60 data-popup-open:ring-4 data-popup-open:ring-primary/15",
            )}
          >
            <SelectValue className="flex min-w-0 flex-1 items-center gap-2.5">
              {(value: string | null) => {
                const { label, Icon } = sortDisplay(
                  (value === DEFAULT_SORT || !value
                    ? ""
                    : value) as MenuSortValue,
                  searching,
                );
                return (
                  <>
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{label}</span>
                  </>
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            align="end"
            alignItemWithTrigger={false}
            sideOffset={6}
            className="min-w-(--anchor-width) rounded-xl bg-card p-1.5 text-foreground shadow-lg sm:min-w-60"
          >
            <SelectGroup>
              <SelectLabel className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Sort dishes
              </SelectLabel>
              {sortOptions.map((option) => {
                const { label, Icon } = sortDisplay(option.value, searching);
                return (
                  <SelectItem
                    key={option.value || DEFAULT_SORT}
                    value={option.value || DEFAULT_SORT}
                    className="group/sort h-10 cursor-pointer gap-2.5 rounded-lg pl-2.5 text-sm *:items-center focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground data-selected:font-semibold"
                  >
                    <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground transition-colors group-data-highlighted/sort:bg-background group-data-selected/sort:bg-primary/12 group-data-selected/sort:text-primary">
                      <Icon className="size-4" />
                    </span>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <nav
          aria-label="Categories"
          className="-mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <CategoryChip
            href={menuHref(filters, { category: "" })}
            active={!filters.category}
            label="All"
            count={totalCount}
          />
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              href={menuHref(filters, { category: category.slug })}
              active={filters.category === category.slug}
              label={category.name}
              count={category.itemCount}
              hidden={!category.isActive}
            />
          ))}
        </nav>

        {hasActiveFilters(filters) && (
          <Link
            href={menuHref(filters, {
              search: "",
              category: "",
              stock: "all",
              visibility: "all",
              sort: "",
            })}
            scroll={false}
            className="hidden shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:block"
          >
            Clear filters
          </Link>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  href,
  active,
  label,
  count,
  hidden,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  hidden?: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      title={hidden ? "This category is hidden from guests" : undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        active
          ? "border-foreground bg-foreground text-background shadow-sm"
          : "border-border bg-card text-foreground/80 hover:border-foreground/25 hover:text-foreground",
      )}
    >
      {hidden && (
        <EyeOff
          className={cn(
            "size-3.5",
            active ? "opacity-70" : "text-muted-foreground",
          )}
        />
      )}
      {label}
      <span
        className={cn(
          "min-w-5 rounded-full px-1.5 text-center text-[11px] tabular-nums",
          active
            ? "bg-background/15 text-background"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "with",
  "in",
  "on",
  "de",
  "la",
  "le",
  "al",
  "el",
]);

export function DishThumb({
  image,
  blur,
  name,
  className,
  sizes = "80px",
}: {
  image?: string | null;
  blur?: string;
  name: string;
  className?: string;
  sizes?: string;
}) {
  const src = mediaSrc(image);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src && failed !== src;

  const initials =
    name
      .split(/\s+/)
      .filter(
        (word) =>
          /^[\p{L}\p{N}]/u.test(word) && !SMALL_WORDS.has(word.toLowerCase()),
      )
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "?";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/5 ring-inset",
        className,
      )}
    >
      {showImage ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          quality={90}
          placeholder={blur ? "blur" : "empty"}
          blurDataURL={blur}
          unoptimized={!canOptimize(src)}
          onError={() => setFailed(src)}
          className="object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_70%)] text-sm font-semibold text-primary">
          {initials}
        </div>
      )}
    </div>
  );
}

export function Highlight({
  text,
  search,
}: {
  text: string;
  search: string;
}): ReactNode {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return text;

  const escaped = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark
        key={index}
        className="rounded-lg bg-primary/18 px-0.5 text-inherit"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function StatusPill({
  item,
  className,
}: {
  item: AdminMenuItem;
  className?: string;
}) {
  if (!item.isVisible) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-dashed border-foreground/20 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground",
          className,
        )}
        title={
          item.isActive
            ? `The ${item.category.name} category is hidden`
            : "This dish is hidden"
        }
      >
        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
        {item.isActive ? "Category hidden" : "Hidden"}
        {!item.isAvailable && (
          <span className="text-muted-foreground/70">· sold out</span>
        )}
      </span>
    );
  }

  if (!item.isAvailable) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-amber-700 dark:text-amber-300",
          className,
        )}
      >
        <span className="size-1.5 rounded-full bg-amber-500" />
        Sold out
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-300",
        className,
      )}
    >
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-50 motion-reduce:hidden" />
        <span className="relative size-1.5 rounded-full bg-emerald-500" />
      </span>
      Available
    </span>
  );
}

export function SaleBadge({
  sale,
  className,
}: {
  sale?: DishSale;
  className?: string;
}) {
  if (!sale) return null;
  const until = sale.endsAt
    ? ` · until ${whenLabel(sale.endsAt, sale.timezone, undefined, "end")}`
    : "";
  return (
    <span
      title={`${sale.name}${until}`}
      className={cn(
        "inline-flex items-center rounded-md bg-primary px-1.5 py-px text-[11px] font-bold text-primary-foreground tabular-nums shadow-[0_2px_8px_-2px_color-mix(in_srgb,var(--primary)_60%,transparent)]",
        className,
      )}
    >
      −{sale.percentOff}%<span className="sr-only"> off: {sale.name}</span>
    </span>
  );
}

export function Badges({ badges }: { badges: string[] }) {
  if (badges.length === 0) return null;
  return (
    <>
      {badges.map((badge) => (
        <span
          key={badge}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-px text-[11px] font-semibold text-primary"
        >
          {badge === "new" ? (
            <Sparkles className="size-3" />
          ) : (
            <Star className="size-3" />
          )}
          {tagLabel(badge)}
        </span>
      ))}
    </>
  );
}

export function DietIcons({
  item,
}: {
  item: Pick<AdminMenuItem, "dietaryTags" | "spiceLevel">;
}) {
  const veg = item.dietaryTags.includes("vegan")
    ? "Vegan"
    : item.dietaryTags.includes("vegetarian")
      ? "Vegetarian"
      : null;
  const glutenFree = item.dietaryTags.includes("gluten-free");
  if (!veg && !glutenFree && item.spiceLevel === 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      {veg && (
        <span title={veg} className="text-emerald-600 dark:text-emerald-400">
          <Leaf className="size-3.5" />
          <span className="sr-only">{veg}</span>
        </span>
      )}
      {glutenFree && (
        <span title="Gluten free">
          <WheatOff className="size-3.5" />
          <span className="sr-only">Gluten free</span>
        </span>
      )}
      {item.spiceLevel > 0 && (
        <span
          title={`Spice ${item.spiceLevel} of 3`}
          className="inline-flex text-red-500"
        >
          {Array.from({ length: item.spiceLevel }, (_, i) => (
            <Flame key={i} className="-mx-px size-3.5" />
          ))}
          <span className="sr-only">Spice level {item.spiceLevel} of 3</span>
        </span>
      )}
    </span>
  );
}

export type DeletableDish = Pick<
  AdminMenuItem,
  "id" | "name" | "image" | "imageBlur" | "isVisible"
>;
export type DeletableCategory = Pick<
  AdminMenuCategory,
  "id" | "name" | "image" | "imageBlur" | "isActive" | "itemCount"
>;

function ConfirmDelete({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  pending,
  disabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending: boolean;
  disabled?: boolean;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <span className="mx-auto mb-1 grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive sm:mx-0">
            <Trash2 className="size-5" />
          </span>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}{" "}
            <span className="font-medium text-foreground">
              This can&apos;t be undone.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {children}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={pending || disabled}
            className="min-w-32"
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {pending ? "Deleting…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeletePreview({
  rows,
}: {
  rows: {
    id: string;
    name: string;
    image?: string | null;
    imageBlur?: string;
    note?: ReactNode;
  }[];
}) {
  const shown = rows.slice(0, 4);
  return (
    <ul className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-2">
      {shown.map((row) => (
        <li key={row.id} className="flex items-center gap-2.5 text-sm">
          <DishThumb
            image={row.image}
            blur={row.imageBlur}
            name={row.name}
            className="size-8 rounded-lg"
            sizes="32px"
          />
          <span className="min-w-0 flex-1 truncate font-medium">
            {row.name}
          </span>
          {row.note}
        </li>
      ))}
      {rows.length > shown.length && (
        <li className="pl-1 text-xs text-muted-foreground">
          and {rows.length - shown.length} more
        </li>
      )}
    </ul>
  );
}

function DishDeleteDialog({
  dishes,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dishes: DeletableDish[];
  onConfirm: () => void;
  pending: boolean;
}) {
  const one = dishes.length === 1;
  const live = dishes.filter((d) => d.isVisible).length;
  return (
    <ConfirmDelete
      {...props}
      title={
        one ? `Delete ${dishes[0]?.name}?` : `Delete ${dishes.length} dishes?`
      }
      description={
        one
          ? "It's removed from the menu and its photo is deleted."
          : "They're removed from the menu and their photos are deleted."
      }
      confirmLabel={one ? "Delete dish" : `Delete ${dishes.length} dishes`}
    >
      {!one && (
        <DeletePreview
          rows={dishes.map((d) => ({
            ...d,
            note: d.isVisible && (
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                On the menu
              </span>
            ),
          }))}
        />
      )}
      {live > 0 && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          {one
            ? "Guests can see this dish right now. To take it off the menu for a while instead, switch off “Show on the menu”."
            : `${live} of them ${live === 1 ? "is" : "are"} on the menu right now. To take dishes off for a while instead, hide them.`}
        </p>
      )}
    </ConfirmDelete>
  );
}

function CategoryDeleteDialog({
  categories,
  withDishes,
  onWithDishesChange,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DeletableCategory[];
  withDishes: boolean;
  onWithDishesChange: (on: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const one = categories.length === 1;
  const dishes = categories.reduce((sum, c) => sum + c.itemCount, 0);
  const dishesLabel = `${dishes} ${dishes === 1 ? "dish" : "dishes"}`;
  return (
    <ConfirmDelete
      {...props}
      disabled={dishes > 0 && !withDishes}
      title={
        one
          ? `Delete ${categories[0]?.name}?`
          : `Delete ${categories.length} categories?`
      }
      description={
        one
          ? "It's removed from the menu and its cover photo is deleted."
          : "They're removed from the menu and their cover photos are deleted."
      }
      confirmLabel={
        dishes > 0 && withDishes
          ? `Delete with ${dishesLabel}`
          : one
            ? "Delete category"
            : `Delete ${categories.length} categories`
      }
    >
      {!one && (
        <DeletePreview
          rows={categories.map((c) => ({
            ...c,
            note: (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {c.itemCount === 0
                  ? "Empty"
                  : `${c.itemCount} ${c.itemCount === 1 ? "dish" : "dishes"}`}
              </span>
            ),
          }))}
        />
      )}

      {dishes > 0 && (
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
            withDishes
              ? "border-destructive/40 bg-destructive/[0.07]"
              : "border-amber-500/30 bg-amber-500/10",
          )}
        >
          <input
            type="checkbox"
            checked={withDishes}
            onChange={(event) => onWithDishesChange(event.target.checked)}
            disabled={props.pending}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-destructive/40",
              withDishes
                ? "border-destructive bg-destructive text-white"
                : "border-foreground/30 bg-background",
            )}
          >
            {withDishes && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          <span className="text-sm">
            <span className="font-medium">
              {one ? "It still has" : "They still have"} {dishesLabel}. Delete{" "}
              {dishes === 1 ? "it" : "them"} too, with photos.
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              To keep {dishes === 1 ? "it" : "them"}, leave this unticked and
              move {dishes === 1 ? "it" : "them"} to another category first.
            </span>
          </span>
        </label>
      )}
    </ConfirmDelete>
  );
}

function useDelete<T>(
  run: (ids: string[]) => Promise<ApiResult<T>>,
  successTitle: (data: T) => { title: string; description?: string },
  onDone: () => void,
) {
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const result = await run(ids);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (data) => {
      toast.add({ ...successTitle(data), type: "success" });
      onDone();
    },
    onError: (error) =>
      toast.add({
        title: "Nothing was deleted",
        description: error.message,
        type: "error",
      }),
  });
}

const dishesDeletedToast = ({ deleted }: { deleted: number }) => ({
  title: deleted === 1 ? "Dish deleted" : `${deleted} dishes deleted`,
});

export function DeleteDishButton({
  dish,
  className,
}: {
  dish: DeletableDish;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const remove = useDelete(deleteMenuItems, dishesDeletedToast, () => {
    setOpen(false);
    router.replace(MENU_PAGE_PATH);
    router.refresh();
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40",
          className,
        )}
      >
        <Trash2 className="size-4" /> Delete
      </button>
      <DishDeleteDialog
        open={open}
        onOpenChange={setOpen}
        dishes={[dish]}
        pending={remove.isPending}
        onConfirm={() => remove.mutate([dish.id])}
      />
    </>
  );
}

type Selection = {
  selecting: boolean;
  start: () => void;
  stop: () => void;
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  total: number;
};

const SelectionContext = createContext<Selection | null>(null);
const useSelection = () => useContext(SelectionContext);

function useSelectionState(ids: string[], dialogOpen: boolean): Selection {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!selecting || dialogOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelecting(false);
      setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, dialogOpen]);

  return {
    selecting,
    start: () => setSelecting(true),
    stop: () => {
      setSelecting(false);
      setSelected(new Set());
    },
    selected,
    toggle: (id) =>
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () =>
      setSelected((current) =>
        current.size === ids.length ? new Set() : new Set(ids),
      ),
    total: ids.length,
  };
}

function SelectionBar({
  selection,
  noun,
  onDelete,
}: {
  selection: Selection;
  noun: string;
  onDelete: () => void;
}) {
  if (!selection.selecting) return null;
  const { selected, total } = selection;
  return (
    <div className="pointer-events-none sticky bottom-4 z-30 mt-4 flex justify-center">
      <div
        role="toolbar"
        aria-label={`Selected ${noun}`}
        className="pointer-events-auto flex items-center gap-1 rounded-2xl bg-foreground p-1.5 pl-4 text-background shadow-2xl ring-1 ring-black/10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
      >
        <span
          className="text-sm font-semibold tabular-nums whitespace-nowrap"
          aria-live="polite"
        >
          {selected.size === 0 ? `Pick ${noun}` : `${selected.size} selected`}
        </span>
        <button
          type="button"
          onClick={selection.toggleAll}
          className="h-9 rounded-xl px-2.5 text-sm font-medium whitespace-nowrap text-background/75 transition-colors hover:bg-background/10 hover:text-background sm:ml-2 sm:px-3"
        >
          {selected.size === total ? (
            "None"
          ) : (
            <>
              All<span className="hidden sm:inline"> {total}</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={selection.stop}
          className="h-9 rounded-xl px-3 text-sm font-medium text-background/75 transition-colors hover:bg-background/10 hover:text-background"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={onDelete}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-destructive px-3.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          <Trash2 className="size-4" /> Delete
        </button>
      </div>
    </div>
  );
}

export function MenuSelection({
  dishes,
  children,
}: {
  dishes: DeletableDish[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const selection = useSelectionState(
    dishes.map((d) => d.id),
    confirming,
  );
  const remove = useDelete(deleteMenuItems, dishesDeletedToast, () => {
    setConfirming(false);
    selection.stop();
    router.refresh();
  });
  const chosen = dishes.filter((d) => selection.selected.has(d.id));

  return (
    <SelectionContext.Provider value={selection}>
      {children}
      <SelectionBar
        selection={selection}
        noun="dishes"
        onDelete={() => setConfirming(true)}
      />
      <DishDeleteDialog
        open={confirming}
        onOpenChange={setConfirming}
        dishes={chosen}
        pending={remove.isPending}
        onConfirm={() => remove.mutate(chosen.map((d) => d.id))}
      />
    </SelectionContext.Provider>
  );
}

export function CategorySelection({
  categories,
  children,
}: {
  categories: DeletableCategory[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [withDishes, setWithDishes] = useState(false);
  const selection = useSelectionState(
    categories.map((c) => c.id),
    confirming,
  );
  const remove = useDelete(
    (ids) => deleteMenuCategories(ids, withDishes),
    ({ deleted, dishesDeleted }) => ({
      title:
        deleted === 1 ? "Category deleted" : `${deleted} categories deleted`,
      description: dishesDeleted
        ? `${dishesDeleted} ${dishesDeleted === 1 ? "dish" : "dishes"} went with ${deleted === 1 ? "it" : "them"}.`
        : undefined,
    }),
    () => {
      setConfirming(false);
      selection.stop();
      router.refresh();
    },
  );
  const chosen = categories.filter((c) => selection.selected.has(c.id));

  return (
    <SelectionContext.Provider value={selection}>
      <div data-selecting={selection.selecting} className="group/select">
        {children}
      </div>
      <SelectionBar
        selection={selection}
        noun="categories"
        onDelete={() => {
          setWithDishes(false);
          setConfirming(true);
        }}
      />
      <CategoryDeleteDialog
        open={confirming}
        onOpenChange={setConfirming}
        categories={chosen}
        withDishes={withDishes}
        onWithDishesChange={setWithDishes}
        pending={remove.isPending}
        onConfirm={() => remove.mutate(chosen.map((c) => c.id))}
      />
    </SelectionContext.Provider>
  );
}

export function SelectToggle({ className }: { className?: string }) {
  const selection = useSelection();
  if (!selection) return null;
  return (
    <button
      type="button"
      onClick={selection.selecting ? selection.stop : selection.start}
      aria-pressed={selection.selecting}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors",
        className,
        selection.selecting
          ? "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <ListChecks className="size-4" />
      {selection.selecting ? "Done" : "Select"}
    </button>
  );
}

function CheckboxMark({ state }: { state: "on" | "off" | "some" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-5 place-items-center rounded-md border-2 transition-colors",
        state === "off"
          ? "border-foreground/25 bg-background"
          : "border-primary bg-primary text-primary-foreground",
      )}
    >
      {state === "on" && <Check className="size-3.5" strokeWidth={3} />}
      {state === "some" && <Minus className="size-3.5" strokeWidth={3} />}
    </span>
  );
}

export function SelectHeadCell() {
  const selection = useSelection();
  if (!selection?.selecting) return null;
  const { selected, total } = selection;
  const state =
    selected.size === 0 ? "off" : selected.size === total ? "on" : "some";
  return (
    <th scope="col" className="w-12 py-2.5 pl-5">
      <button
        type="button"
        role="checkbox"
        aria-checked={state === "some" ? "mixed" : state === "on"}
        aria-label="Select all dishes on this page"
        onClick={selection.toggleAll}
        className="grid place-items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <CheckboxMark state={state} />
      </button>
    </th>
  );
}

export function SelectCell({ id, name }: { id: string; name: string }) {
  const selection = useSelection();
  if (!selection?.selecting) return null;
  const on = selection.selected.has(id);
  return (
    <td className="w-12 py-3 pl-5" data-selected={on}>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-label={`Select ${name}`}
        onClick={() => selection.toggle(id)}
        className="grid place-items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <CheckboxMark state={on ? "on" : "off"} />
      </button>
    </td>
  );
}

export function SelectCardOverlay({
  id,
  name,
  corner = "start",
  className,
}: {
  id: string;
  name: string;
  corner?: "start" | "end";
  className?: string;
}) {
  const selection = useSelection();
  if (!selection?.selecting) return null;
  const on = selection.selected.has(id);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={`Select ${name}`}
      data-selected={on}
      onClick={() => selection.toggle(id)}
      className={cn(
        "absolute inset-0 z-10 flex items-start p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset",
        corner === "end" && "justify-end p-3",
        on && "bg-primary/6 ring-2 ring-primary/40 ring-inset",
        className,
      )}
    >
      <span className="rounded-md bg-background shadow-sm">
        <CheckboxMark state={on ? "on" : "off"} />
      </span>
    </button>
  );
}
