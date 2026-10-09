"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  EyeOff,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  cleanSearch,
  hasActiveFilters,
  menuHref,
  SORT_OPTIONS,
  type MenuFilters,
  type MenuSortValue,
} from "@/admin/lib/menu/params";
import type { MenuSummary } from "@/admin/lib/menu/types";

const SEARCH_DELAY_MS = 300;

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
  const sortOptions = SORT_OPTIONS.filter(
    (o) => o.value !== "relevance" || searching || filters.sort === "relevance",
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

        <div className="relative sm:w-52">
          <label htmlFor="menu-sort" className="sr-only">
            Sort by
          </label>
          <ArrowUpDown className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            id="menu-sort"
            value={filters.sort}
            onChange={(event) =>
              go(
                menuHref(filters, {
                  sort: event.target.value as MenuSortValue,
                }),
              )
            }
            className="h-11 w-full appearance-none rounded-xl border border-border bg-card pr-9 pl-10 text-sm font-medium shadow-xs outline-none transition hover:border-foreground/20 focus:border-primary/60 focus:ring-4 focus:ring-primary/15"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value === "" && searching ? "Best match" : option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
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
