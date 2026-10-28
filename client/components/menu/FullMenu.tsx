"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Clock,
  Flame,
  Leaf,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Sprout,
  Star,
  UtensilsCrossed,
  WheatOff,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { daysLabel, whenLabel } from "@/lib/promotions";
import type { Day } from "@/lib/opening-hours";
import { canOptimize, mediaSrc } from "@/admin/lib/menu/format";
import { formatMoney, type CurrencyConfig } from "@/lib/menu/money";
import { flyToCart, MAX_LINE_NOTE, MAX_LINE_QUANTITY } from "@/lib/cart";
import { useMenuAdd } from "@/components/whatsapp/WhatsAppOrder";
import type { PublicDish, PublicMenuCategory } from "@/lib/menu/public-menu";

export type FullMenuVariant = "tabs" | "list" | "grid";
export type FullMenuOptions = {
  showImages: boolean;
  showSearch: boolean;
  showFilters: boolean;
  showAllergens: boolean;
};

type Props = {
  categories: PublicMenuCategory[];
  variant: FullMenuVariant;
  options: FullMenuOptions;
  currency: CurrencyConfig;
  ordering: boolean;
  soldOut: "hide" | "show-sold-out";
  pricingNote?: string;
};

type Diet = { tag: string; label: string; icon?: ReactNode };

const DIETS: Diet[] = [
  {
    tag: "vegetarian",
    label: "Vegetarian",
    icon: <Leaf className="size-3.5" />,
  },
  { tag: "vegan", label: "Vegan", icon: <Sprout className="size-3.5" /> },
  {
    tag: "gluten-free",
    label: "Gluten free",
    icon: <WheatOff className="size-3.5" />,
  },
  { tag: "dairy-free", label: "Dairy free" },
  { tag: "nut-free", label: "Nut free" },
  { tag: "halal", label: "Halal" },
  { tag: "kosher", label: "Kosher" },
];
const SPICY = "spicy";

const BADGES: Record<string, string> = {
  "chefs-pick": "Chef's pick",
  new: "New",
  popular: "Popular",
  signature: "Signature",
  seasonal: "Seasonal",
  limited: "Limited",
};

const SCROLL_ROW =
  "overflow-x-auto overscroll-x-contain scrollbar-none [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,black_var(--pad),black_calc(100%-var(--pad)),transparent)]";

const allergenLabel = (a: string) =>
  a === "tree-nuts" ? "Tree nuts" : a.charAt(0).toUpperCase() + a.slice(1);

const normalize = (text: string) =>
  text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

function servingLabel(
  windows: PublicMenuCategory["servingHours"],
): string | null {
  if (windows.length === 0) return null;
  return windows
    .map((w) => {
      const days =
        w.days.length === 0 || w.days.length === 7
          ? ""
          : ` · ${daysLabel(w.days as Day[])}`;
      return `${w.from}–${w.to}${days}`;
    })
    .join(", ");
}

function priceOf(dish: PublicDish) {
  const rows = dish.variants.length
    ? dish.variants
    : [{ price: dish.price, salePrice: dish.salePrice }];
  const now = rows.map((r) => r.salePrice ?? r.price);
  const lowest = Math.min(...now);
  const cheapest = rows[now.indexOf(lowest)];
  const was =
    dish.sale && cheapest.salePrice !== undefined
      ? cheapest.price
      : dish.variants.length === 0 &&
          dish.compareAtPrice &&
          dish.compareAtPrice > dish.price
        ? dish.compareAtPrice
        : undefined;
  return { amount: lowest, from: now.some((p) => p !== lowest), was };
}

const needsChoice = (dish: PublicDish) =>
  dish.variants.length > 0 || dish.modifierGroups.some((g) => g.minSelect > 0);

const defaultOptions = (dish: PublicDish) =>
  dish.modifierGroups.flatMap((g) =>
    g.options
      .filter((o) => o.isDefault && o.isAvailable !== false)
      .slice(0, g.maxSelect)
      .map((o) => o.id),
  );

export function FullMenu({
  categories,
  variant,
  options,
  currency,
  ordering,
  soldOut,
  pricingNote,
}: Props) {
  const [query, setQuery] = useState("");
  const [diets, setDiets] = useState<ReadonlySet<string>>(new Set());
  const [openDish, setOpenDish] = useState<PublicDish | null>(null);

  const adding = useMenuAdd();
  const addingId = adding.isPending ? adding.variables?.itemId : undefined;
  const quickAdd = (dish: PublicDish, button: HTMLElement) => {
    if (needsChoice(dish)) return setOpenDish(dish);
    if (adding.isPending) return;

    const from = (
      button.closest("li")?.querySelector("img") ?? button
    ).getBoundingClientRect();
    adding.mutate(
      {
        itemId: dish.id,
        optionIds: defaultOptions(dish),
        quantity: 1,
        name: dish.name,
        dish,
      },
      {
        onSuccess: () =>
          flyToCart(from, options.showImages ? mediaSrc(dish.image) : null),
      },
    );
  };
  const [active, setActive] = useState(categories[0]?.slug ?? "");

  const availableDiets = useMemo(() => {
    const tags = new Set(
      categories.flatMap((c) => c.items.flatMap((d) => d.dietaryTags)),
    );
    const list: Diet[] = DIETS.filter((d) => tags.has(d.tag));
    if (categories.some((c) => c.items.some((d) => d.spiceLevel > 0)))
      list.push({
        tag: SPICY,
        label: "Spicy",
        icon: <Flame className="size-3.5" />,
      });
    return list;
  }, [categories]);

  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const filtering = terms.length > 0 || diets.size > 0;
  const shown = categories
    .map((category) => ({
      ...category,
      items: category.items.filter((dish) => {
        if (soldOut === "hide" && !dish.isAvailable) return false;
        if (terms.length) {
          const text = normalize(`${dish.name} ${dish.description ?? ""}`);
          if (!terms.every((t) => text.includes(t))) return false;
        }
        for (const diet of diets) {
          if (
            diet === SPICY
              ? dish.spiceLevel === 0
              : !(
                  dish.dietaryTags.includes(diet) ||
                  (diet === "vegetarian" && dish.dietaryTags.includes("vegan"))
                )
          )
            return false;
        }
        return true;
      }),
    }))
    .filter((c) => c.items.length > 0);
  const total = shown.reduce((sum, c) => sum + c.items.length, 0);

  const paged = variant === "tabs" && !filtering;
  const currentIndex = Math.max(
    0,
    shown.findIndex((c) => c.slug === active),
  );
  const current = shown[currentIndex];
  const visible = paged ? (current ? [current] : []) : shown;
  const selected = paged ? (current?.slug ?? "") : active;

  const sections = useRef(new Map<string, HTMLElement>());
  const nav = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const jumping = useRef(false);

  useEffect(() => {
    if (paged) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (jumping.current) return;
        const seen = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (seen) setActive((seen.target as HTMLElement).dataset.slug ?? "");
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    sections.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [paged, shown.length, query, diets]);

  useEffect(() => {
    const row = nav.current;
    const tab = row?.querySelector<HTMLElement>(`[data-tab="${selected}"]`);
    if (!row || !tab) return;
    row.scrollTo({
      left: tab.offsetLeft - row.clientWidth / 2 + tab.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [selected]);

  const smooth = (): ScrollBehavior =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";

  const jump = (slug: string) => {
    const el = sections.current.get(slug);
    if (!el) return;
    setActive(slug);
    jumping.current = true;
    el.scrollIntoView({ behavior: smooth(), block: "start" });
    window.setTimeout(() => (jumping.current = false), 700);
  };

  const select = (slug: string) => {
    setActive(slug);
    const top = content.current?.getBoundingClientRect().top;
    const below = bar.current?.getBoundingClientRect().bottom ?? 0;
    if (top !== undefined && top < below)
      window.scrollTo({
        top: window.scrollY + top - below - 8,
        behavior: smooth(),
      });
  };

  const pick = paged ? select : jump;

  const toggleDiet = (tag: string) =>
    setDiets((now) => {
      const next = new Set(now);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  const clear = () => {
    setQuery("");
    setDiets(new Set());
  };

  const showSearch = options.showSearch;
  const showFilters = options.showFilters && availableDiets.length > 0;
  const sidebar = variant === "list";
  const next = paged ? shown[currentIndex + 1] : undefined;

  const count = filtering && (
    <p className="text-sm text-foreground/60" aria-live="polite">
      {total} {total === 1 ? "dish" : "dishes"}
      <button
        type="button"
        onClick={clear}
        className="ml-2 font-semibold text-primary underline-offset-4 hover:underline"
      >
        Clear
      </button>
    </p>
  );

  return (
    <div className="overflow-x-clip px-(--pad) pb-24 [--pad:clamp(1.1rem,4vw,3.5rem)]">
      <div
        ref={bar}
        className={cn(
          "sticky top-(--nav-offset,4.5rem) z-30 -mx-(--pad) border-b border-foreground/10 bg-background px-(--pad)",
          sidebar && "lg:hidden",
        )}
      >
        <div className="mx-auto max-w-6xl">
          <div
            ref={nav}
            role={paged ? "tablist" : undefined}
            aria-label="Menu categories"
            className={cn("-mx-(--pad) flex gap-1 px-(--pad) py-3", SCROLL_ROW)}
          >
            {shown.map((category) => {
              const on = selected === category.slug;
              return (
                <button
                  key={category.slug}
                  type="button"
                  data-tab={category.slug}
                  role={paged ? "tab" : undefined}
                  aria-selected={paged ? on : undefined}
                  aria-current={!paged && on ? "true" : undefined}
                  onClick={() => pick(category.slug)}
                  className={cn(
                    "relative inline-flex max-w-[min(17rem,72vw)] shrink-0 items-center rounded-full px-4 py-2 text-[15px] font-medium whitespace-nowrap transition-colors",
                    on
                      ? "bg-foreground text-background"
                      : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  <span className="truncate">{category.name}</span>
                  <span
                    className={cn(
                      "ml-1.5 shrink-0 text-xs tabular-nums",
                      on ? "text-background/60" : "text-foreground/40",
                    )}
                  >
                    {category.items.length}
                  </span>
                </button>
              );
            })}
          </div>

          {(showSearch || showFilters || filtering) && (
            <div className="flex flex-col gap-2.5 pb-3 sm:flex-row sm:items-center">
              {showSearch && (
                <SearchBox
                  query={query}
                  onChange={setQuery}
                  className="sm:w-72"
                />
              )}
              {showFilters && (
                <DietFilters
                  diets={availableDiets}
                  selected={diets}
                  onToggle={toggleDiet}
                  className={cn(
                    "-mx-(--pad) px-(--pad) sm:mx-0 sm:px-0 sm:mask-none",
                    SCROLL_ROW,
                  )}
                />
              )}
              {count && <div className="sm:ml-auto">{count}</div>}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "mx-auto max-w-6xl",
          sidebar &&
            "lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:gap-16 xl:gap-20",
        )}
      >
        {sidebar && (
          <aside className="hidden lg:block">
            <div className="sticky top-[calc(var(--nav-offset,4.5rem)+1.5rem)] max-h-[calc(100dvh-var(--nav-offset,4.5rem)-3rem)] overflow-y-auto pt-14 pb-6 scrollbar-thin">
              {showSearch && <SearchBox query={query} onChange={setQuery} />}
              <p className="mt-8 mb-2 text-xs font-semibold tracking-[0.16em] text-foreground/45 uppercase">
                Categories
              </p>
              <nav aria-label="Menu categories">
                <ul className="border-l border-foreground/10">
                  {shown.map((category) => {
                    const on = active === category.slug;
                    return (
                      <li key={category.slug}>
                        <button
                          type="button"
                          onClick={() => jump(category.slug)}
                          aria-current={on ? "true" : undefined}
                          className={cn(
                            "-ml-px flex w-full items-center justify-between gap-3 border-l-2 py-2 pr-2 pl-4 text-left text-[15px] transition-colors",
                            on
                              ? "border-primary font-semibold text-foreground"
                              : "border-transparent text-foreground/60 hover:border-foreground/30 hover:text-foreground",
                          )}
                        >
                          <span className="truncate">{category.name}</span>
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              on ? "text-primary" : "text-foreground/40",
                            )}
                          >
                            {category.items.length}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              {showFilters && (
                <>
                  <p className="mt-8 mb-2.5 text-xs font-semibold tracking-[0.16em] text-foreground/45 uppercase">
                    Dietary
                  </p>
                  <DietFilters
                    diets={availableDiets}
                    selected={diets}
                    onToggle={toggleDiet}
                    className="flex-wrap"
                  />
                </>
              )}
              {count && <div className="mt-6">{count}</div>}
            </div>
          </aside>
        )}

        <div ref={content} className="min-w-0">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center py-24 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-foreground/5 text-foreground/50">
                <UtensilsCrossed className="size-6" />
              </span>
              <p className="mt-4 text-xl font-medium">
                {filtering ? "Nothing matches" : "The menu is being prepared"}
              </p>
              <p className="mt-1 max-w-sm text-foreground/60">
                {filtering
                  ? "Try another word, or fewer filters."
                  : "Come back soon, or give us a call to hear what's cooking today."}
              </p>
              {filtering && (
                <button
                  type="button"
                  onClick={clear}
                  className="mt-5 rounded-full border border-foreground/20 px-5 py-2.5 font-semibold transition-colors hover:bg-foreground/5"
                >
                  Show the whole menu
                </button>
              )}
            </div>
          ) : (
            visible.map((category) => (
              <section
                key={category.slug}
                id={category.slug}
                data-slug={category.slug}
                ref={(el) => {
                  if (el) sections.current.set(category.slug, el);
                  else sections.current.delete(category.slug);
                }}
                role={paged ? "tabpanel" : undefined}
                aria-labelledby={`menu-${category.slug}`}
                className={cn(
                  "scroll-mt-[calc(var(--nav-height,4.5rem)+8.5rem)] pt-14 sm:pt-16",
                  sidebar &&
                    "lg:scroll-mt-[calc(var(--nav-height,4.5rem)+1rem)]",
                  paged &&
                    "transition duration-300 ease-out starting:translate-y-2 starting:opacity-0",
                )}
              >
                {variant === "grid" ? (
                  <>
                    <CategoryHeader
                      category={category}
                      banner={options.showImages}
                    />
                    <ul className="mt-7 grid grid-cols-1 gap-x-5 gap-y-9 min-[560px]:grid-cols-2 min-[1000px]:grid-cols-3">
                      {category.items.map((dish) => (
                        <DishTile
                          key={dish.id}
                          dish={dish}
                          currency={currency}
                          ordering={ordering}
                          showImage={options.showImages}
                          onOpen={() => setOpenDish(dish)}
                          onAdd={(el) => quickAdd(dish, el)}
                          adding={addingId === dish.id}
                        />
                      ))}
                    </ul>
                  </>
                ) : variant === "list" ? (
                  <>
                    <CategoryHeader category={category} />
                    <ul className="mt-2">
                      {category.items.map((dish) => (
                        <DishLine
                          key={dish.id}
                          dish={dish}
                          currency={currency}
                          ordering={ordering}
                          showImage={options.showImages}
                          onOpen={() => setOpenDish(dish)}
                          onAdd={(el) => quickAdd(dish, el)}
                          adding={addingId === dish.id}
                        />
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <CategoryHeader category={category} />
                    <ul className="mt-7 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
                      {category.items.map((dish) => (
                        <DishRow
                          key={dish.id}
                          dish={dish}
                          currency={currency}
                          ordering={ordering}
                          showImage={options.showImages}
                          onOpen={() => setOpenDish(dish)}
                          onAdd={(el) => quickAdd(dish, el)}
                          adding={addingId === dish.id}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </section>
            ))
          )}

          {next && (
            <button
              type="button"
              onClick={() => select(next.slug)}
              className="group mt-12 flex w-full items-center justify-between gap-4 rounded-[calc(var(--radius,0.75rem)*1.6)] border border-foreground/10 bg-foreground/3 px-6 py-5 text-left transition-colors hover:border-foreground/25 hover:bg-foreground/6"
            >
              <span>
                <span className="block text-xs font-semibold tracking-[0.16em] text-foreground/50 uppercase">
                  Next
                </span>
                <span className="mt-0.5 block text-xl font-medium tracking-tight">
                  {next.name}
                </span>
              </span>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background transition-transform group-hover:translate-x-1">
                <ArrowRight className="size-5" />
              </span>
            </button>
          )}

          {pricingNote && visible.length > 0 && (
            <p className="mt-16 border-t border-foreground/10 pt-6 text-center text-sm text-foreground/55">
              {pricingNote}
            </p>
          )}
        </div>
      </div>

      {openDish && (
        <DishSheet
          key={openDish.id}
          dish={openDish}
          currency={currency}
          ordering={ordering}
          showAllergens={options.showAllergens}
          showImage={options.showImages}
          onClose={() => setOpenDish(null)}
        />
      )}
    </div>
  );
}

function SearchBox({
  query,
  onChange,
  className,
}: {
  query: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("group relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-foreground/45 transition-colors group-focus-within:text-primary" />
      <input
        type="search"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search the menu"
        aria-label="Search the menu"
        className="h-11 w-full rounded-full border border-foreground/15 bg-background pr-10 pl-11 text-[15px] outline-none transition placeholder:text-foreground/45 focus:border-primary/60 focus:ring-4 focus:ring-primary/15 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {query && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function DietFilters({
  diets,
  selected,
  onToggle,
  className,
}: {
  diets: Diet[];
  selected: ReadonlySet<string>;
  onToggle: (tag: string) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Dietary filters"
      className={cn("flex gap-1.5", className)}
    >
      {diets.map((diet) => {
        const on = selected.has(diet.tag);
        return (
          <button
            key={diet.tag}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(diet.tag)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-all",
              on
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-foreground/15 text-foreground/75 hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {diet.icon}
            {diet.label}
          </button>
        );
      })}
    </div>
  );
}

function CategoryHeader({
  category,
  banner,
}: {
  category: PublicMenuCategory;
  banner?: boolean;
}) {
  const serving = servingLabel(category.servingHours);
  const image = banner ? mediaSrc(category.image) : null;
  return (
    <header>
      {image && (
        <div className="relative mb-7 aspect-16/7 overflow-hidden rounded-[calc(var(--radius,0.75rem)*1.8)] bg-foreground/5 sm:aspect-21/7">
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1200px) 1152px, 100vw"
            placeholder={category.imageBlur ? "blur" : "empty"}
            blurDataURL={category.imageBlur}
            unoptimized={!canOptimize(image)}
            className="object-cover"
          />
        </div>
      )}
      <div className="flex flex-col gap-3 border-b border-foreground/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2
            id={`menu-${category.slug}`}
            className="text-[clamp(1.9rem,3.6vw,2.75rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance wrap-anywhere"
          >
            {category.name}
          </h2>
          {category.description && (
            <p className="mt-2 max-w-xl text-pretty text-foreground/65">
              {category.description}
            </p>
          )}
        </div>
        {serving && (
          <p className="inline-flex max-w-full items-center gap-1.5 self-start rounded-2xl bg-foreground/6 px-3 py-1.5 text-sm text-foreground/70 tabular-nums sm:shrink-0 sm:self-auto sm:rounded-full">
            <Clock className="size-3.5 shrink-0" />{" "}
            <span>Served {serving}</span>
          </p>
        )}
      </div>
    </header>
  );
}

type DishProps = {
  dish: PublicDish;
  currency: CurrencyConfig;
  ordering: boolean;
  showImage: boolean;
  onOpen: () => void;
  onAdd: (button: HTMLElement) => void;
  adding: boolean;
};

function DishRow({
  dish,
  currency,
  ordering,
  showImage,
  onOpen,
  onAdd,
  adding,
}: DishProps) {
  const soldOut = !dish.isAvailable;
  const src = showImage ? mediaSrc(dish.image) : null;
  return (
    <li className="group relative min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex h-full w-full gap-4 rounded-[calc(var(--radius,0.75rem)*1.4)] border border-foreground/10 bg-background p-4 text-left transition-all sm:p-5",
          "hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_12px_30px_-18px_rgb(0_0_0/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          soldOut && "opacity-60",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <DishTitle dish={dish} />
          {dish.description && (
            <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-pretty text-foreground/65 wrap-anywhere">
              {dish.description}
            </p>
          )}
          <DishMarks dish={dish} />
          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <Price dish={dish} currency={currency} />
          </div>
        </div>
        {src && (
          <div className="relative size-28 shrink-0 self-start overflow-hidden rounded-[calc(var(--radius,0.75rem)*1.1)] bg-foreground/5 sm:size-32">
            <DishImage
              dish={dish}
              src={src}
              sizes="256px"
              className="transition-transform duration-500 group-hover:scale-105"
            />
            <SaleTag dish={dish} className="absolute top-1.5 left-1.5" />
          </div>
        )}
      </button>
      {ordering && (
        <AddButton
          dish={dish}
          onClick={onAdd}
          busy={adding}
          className={cn(
            "absolute",
            src
              ? "right-3 bottom-3 sm:right-4 sm:bottom-4"
              : "right-4 bottom-4",
          )}
        />
      )}
    </li>
  );
}

function DishLine({ dish, currency, ordering, showImage, onOpen }: DishProps) {
  const soldOut = !dish.isAvailable;
  const src = showImage ? mediaSrc(dish.image) : null;
  const { amount, from, was } = priceOf(dish);
  return (
    <li className="border-b border-foreground/10">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group flex w-full gap-4 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
          soldOut && "opacity-55",
        )}
      >
        {src && (
          <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-foreground/5 sm:size-18">
            <DishImage dish={dish} src={src} sizes="144px" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="min-w-0 text-lg leading-snug font-medium text-balance group-hover:text-primary wrap-anywhere">
              {dish.name}
            </span>
            <span
              aria-hidden
              className="mb-1.5 hidden min-w-6 flex-1 border-b border-dotted border-foreground/30 sm:block"
            />
            <span className="ml-auto shrink-0 text-right font-semibold tabular-nums sm:ml-0">
              {was !== undefined && (
                <span className="mr-2 text-sm font-normal text-foreground/45 line-through">
                  {formatMoney(was, currency).main}
                </span>
              )}
              <span className={cn(dish.sale && "text-primary")}>
                {from && (
                  <span className="mr-1 text-sm font-normal text-foreground/55">
                    from
                  </span>
                )}
                {formatMoney(amount, currency).main}
              </span>
            </span>
          </div>
          {dish.description && (
            <p className="mt-1 line-clamp-2 text-[15px] text-pretty text-foreground/65 wrap-anywhere">
              {dish.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {soldOut && (
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-semibold text-foreground/70">
                Sold out
              </span>
            )}
            <SaleTag dish={dish} />
            <DishMarks dish={dish} compact />
            {ordering && !soldOut && (
              <span className="ml-auto hidden items-center gap-1 text-sm font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline-flex">
                <Plus className="size-4" /> Add
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

function DishTile({
  dish,
  currency,
  ordering,
  showImage,
  onOpen,
  onAdd,
  adding,
}: DishProps) {
  const soldOut = !dish.isAvailable;
  const src = showImage ? mediaSrc(dish.image) : null;
  return (
    <li className="group relative min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
          soldOut && "opacity-60",
        )}
      >
        {showImage && (
          <div className="relative aspect-4/3 overflow-hidden rounded-[calc(var(--radius,0.75rem)*1.6)] bg-foreground/5">
            {src ? (
              <DishImage
                dish={dish}
                src={src}
                sizes="(min-width: 1000px) 33vw, (min-width: 560px) 50vw, 100vw"
                className="transition-transform duration-700 group-hover:scale-[1.04]"
              />
            ) : (
              <div className="grid size-full place-items-center text-foreground/25">
                <UtensilsCrossed className="size-10" />
              </div>
            )}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {soldOut && (
                <span className="rounded-full bg-background/90 px-3 py-1 text-sm font-semibold text-foreground backdrop-blur">
                  Sold out
                </span>
              )}
              <SaleTag dish={dish} large />
              {dish.badges[0] && BADGES[dish.badges[0]] && !soldOut && (
                <span className="rounded-full bg-background/90 px-3 py-1 text-sm font-medium text-foreground backdrop-blur">
                  {BADGES[dish.badges[0]]}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="mt-4 flex items-start justify-between gap-4">
          <span className="min-w-0 text-lg leading-snug font-semibold text-balance wrap-anywhere">
            {dish.name}
          </span>
          <Price dish={dish} currency={currency} align="right" />
        </div>
        {dish.description && (
          <p className="mt-1.5 line-clamp-2 text-pretty text-foreground/65 wrap-anywhere">
            {dish.description}
          </p>
        )}
        <DishMarks dish={dish} />
      </button>
      {ordering && (
        <AddButton
          dish={dish}
          onClick={onAdd}
          busy={adding}
          className={cn(
            "absolute",
            showImage ? "top-0 right-3 mt-3" : "right-0 bottom-0",
          )}
          large={showImage}
        />
      )}
    </li>
  );
}

function DishTitle({ dish }: { dish: PublicDish }) {
  const badge = dish.badges.find((b) => BADGES[b]);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="min-w-0 text-[17px] leading-snug font-semibold text-balance wrap-anywhere">
        {dish.name}
      </span>
      {!dish.isAvailable ? (
        <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-semibold text-foreground/70">
          Sold out
        </span>
      ) : (
        badge && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {badge === "new" ? (
              <Sparkles className="size-3" />
            ) : (
              <Star className="size-3" />
            )}
            {BADGES[badge]}
          </span>
        )
      )}
    </div>
  );
}

function DishMarks({ dish, compact }: { dish: PublicDish; compact?: boolean }) {
  const marks = DIETS.filter((d) => d.icon && dish.dietaryTags.includes(d.tag));
  const veganShown = dish.dietaryTags.includes("vegan");
  const visible = marks.filter((m) => !(veganShown && m.tag === "vegetarian"));
  if (visible.length === 0 && dish.spiceLevel === 0) return null;
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-foreground/60",
        !compact && "mt-2.5",
      )}
    >
      {visible.map((m) => (
        <li key={m.tag} className="inline-flex items-center gap-1">
          <span className="text-emerald-700 dark:text-emerald-400">
            {m.icon}
          </span>
          {m.label}
        </li>
      ))}
      {dish.spiceLevel > 0 && (
        <li
          className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400"
          title={`Spice ${dish.spiceLevel} of 3`}
        >
          {Array.from({ length: dish.spiceLevel }, (_, i) => (
            <Flame key={i} className="size-3.5" />
          ))}
          <span className="sr-only">Spicy, level {dish.spiceLevel} of 3</span>
        </li>
      )}
    </ul>
  );
}

function Price({
  dish,
  currency,
  align = "left",
}: {
  dish: PublicDish;
  currency: CurrencyConfig;
  align?: "left" | "right";
}) {
  const { amount, from, was } = priceOf(dish);
  const now = formatMoney(amount, currency);
  return (
    <p
      className={cn(
        "leading-tight tabular-nums",
        align === "right" && "shrink-0 text-right",
      )}
    >
      <span
        className={cn(
          "text-[17px] font-semibold",
          dish.sale && "text-primary",
          !dish.isAvailable && "text-foreground/50",
        )}
      >
        {from && (
          <span className="mr-1 text-sm font-normal text-foreground/55">
            from
          </span>
        )}
        {now.main}
      </span>
      {was !== undefined && (
        <span
          className={cn(
            "text-sm text-foreground/45 line-through",
            align === "right" ? "block" : "ml-2",
          )}
        >
          <span className="sr-only">was </span>
          {formatMoney(was, currency).main}
        </span>
      )}
      {now.sub && (
        <span className="block text-xs text-foreground/50">{now.sub}</span>
      )}
    </p>
  );
}

function SaleTag({
  dish,
  className,
  large,
}: {
  dish: PublicDish;
  className?: string;
  large?: boolean;
}) {
  if (!dish.sale || !dish.isAvailable) return null;
  return (
    <span
      title={dish.sale.name}
      className={cn(
        "rounded-full bg-primary font-bold text-primary-foreground tabular-nums shadow-sm",
        large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs",
        className,
      )}
    >
      −{dish.sale.percentOff}%
      <span className="sr-only"> off: {dish.sale.name}</span>
    </span>
  );
}

function AddButton({
  dish,
  onClick,
  busy,
  className,
  large,
}: {
  dish: PublicDish;
  onClick: (button: HTMLElement) => void;
  busy: boolean;
  className?: string;
  large?: boolean;
}) {
  if (!dish.isAvailable) return null;
  return (
    <button
      type="button"
      onClick={(event) => onClick(event.currentTarget)}
      disabled={busy}
      aria-busy={busy}
      aria-label={
        needsChoice(dish)
          ? `Choose options for ${dish.name}`
          : `Add ${dish.name} to your order`
      }
      className={cn(
        "grid place-items-center rounded-full bg-primary text-white shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--primary)_75%,transparent)] transition hover:scale-105 hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        large ? "size-11" : "size-10",
        className,
      )}
    >
      {busy ? (
        <LoaderCircle className="size-5 animate-spin" />
      ) : (
        <Plus className="size-5" strokeWidth={2.5} />
      )}
    </button>
  );
}

function DishImage({
  dish,
  src,
  sizes,
  className,
}: {
  dish: PublicDish;
  src: string;
  sizes: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      quality={90}
      placeholder={dish.imageBlur ? "blur" : "empty"}
      blurDataURL={dish.imageBlur}
      unoptimized={!canOptimize(src)}
      className={cn(
        "object-cover",
        !dish.isAvailable && "grayscale",
        className,
      )}
    />
  );
}

function DishSheet({
  dish,
  currency,
  ordering,
  showAllergens,
  showImage,
  onClose,
}: {
  dish: PublicDish;
  currency: CurrencyConfig;
  ordering: boolean;
  showAllergens: boolean;
  showImage: boolean;
  onClose: () => void;
}) {
  const firstSize =
    dish.variants.find((v) => v.isDefault && v.isAvailable !== false) ??
    dish.variants.find((v) => v.isAvailable !== false);
  const [sizeId, setSizeId] = useState(firstSize?.id ?? null);
  const [chosen, setChosen] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      dish.modifierGroups.map((g) => [
        g.id,
        g.options
          .filter((o) => o.isDefault && o.isAvailable !== false)
          .map((o) => o.id),
      ]),
    ),
  );
  const [quantity, setQuantity] = useState(1);
  const [tried, setTried] = useState(false);
  const [note, setNote] = useState("");
  const photo = useRef<HTMLDivElement>(null);
  const add = useMenuAdd({ onAdded: onClose });

  const size = dish.variants.find((v) => v.id === sizeId);
  const base = size
    ? (size.salePrice ?? size.price)
    : (dish.salePrice ?? dish.price);
  const baseWas = size
    ? size.salePrice !== undefined
      ? size.price
      : undefined
    : dish.salePrice !== undefined
      ? dish.price
      : undefined;
  const extras = dish.modifierGroups.reduce(
    (sum, g) =>
      sum +
      g.options
        .filter((o) => chosen[g.id]?.includes(o.id))
        .reduce((s, o) => s + (o.priceDelta ?? 0), 0),
    0,
  );
  const total = (base + extras) * quantity;
  const missing = dish.modifierGroups.filter(
    (g) => (chosen[g.id]?.length ?? 0) < g.minSelect,
  );
  const src = showImage ? mediaSrc(dish.image) : null;

  const pick = (groupId: string, optionId: string, max: number) =>
    setChosen((current) => {
      const list = current[groupId] ?? [];
      if (max === 1)
        return {
          ...current,
          [groupId]: list.includes(optionId) ? [] : [optionId],
        };
      if (list.includes(optionId))
        return { ...current, [groupId]: list.filter((id) => id !== optionId) };
      if (list.length >= max) return current;
      return { ...current, [groupId]: [...list, optionId] };
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[92dvh] flex-col gap-0 overflow-hidden border-0 p-0 text-left sm:max-h-[calc(100dvh-3rem)] sm:max-w-xl",
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:rounded-b-none",
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {src ? (
            <div ref={photo} className="relative aspect-16/10 bg-foreground/5">
              <DishImage
                dish={dish}
                src={src}
                sizes="(min-width: 640px) 576px, 100vw"
              />
              <SaleTag dish={dish} large className="absolute bottom-4 left-4" />
            </div>
          ) : (
            <div className="h-14" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur transition hover:bg-background"
          >
            <X className="size-5" />
          </button>
          <span
            aria-hidden
            className="absolute top-2 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/70 sm:hidden"
          />

          <div className="px-5 pt-5 pb-6 sm:px-7">
            <DialogTitle className="text-[1.75rem] leading-tight font-medium tracking-[-0.02em] text-balance wrap-anywhere">
              {dish.name}
            </DialogTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DishTitleBadges dish={dish} />
            </div>
            {dish.description && (
              <DialogDescription className="mt-3 text-base leading-relaxed text-pretty text-foreground/70">
                {dish.description}
              </DialogDescription>
            )}

            {dish.sale && dish.sale.endsAt && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                <Sparkles className="size-4" />
                {dish.sale.name}: {dish.sale.percentOff}% off until{" "}
                {whenLabel(
                  dish.sale.endsAt,
                  dish.sale.timezone,
                  undefined,
                  "end",
                )}
              </p>
            )}

            <DishMarks dish={dish} />

            {(dish.calories != null || dish.prepTimeMinutes != null) && (
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/60">
                {dish.calories != null && <span>{dish.calories} kcal</span>}
                {dish.prepTimeMinutes != null && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" /> About {dish.prepTimeMinutes}{" "}
                    min
                  </span>
                )}
              </p>
            )}

            {dish.variants.length > 0 && (
              <fieldset className="mt-7">
                <legend className="flex w-full items-center justify-between text-[15px] font-semibold">
                  Size{" "}
                  <span className="rounded-full bg-foreground/[0.07] px-2 py-0.5 text-xs font-medium text-foreground/60">
                    Pick 1
                  </span>
                </legend>
                <div className="mt-3 space-y-2">
                  {dish.variants.map((variant) => {
                    const off = variant.isAvailable === false;
                    const on = sizeId === variant.id;
                    return (
                      <label
                        key={variant.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all",
                          on
                            ? "border-primary bg-primary/6 ring-1 ring-primary"
                            : "border-foreground/15 hover:border-foreground/30",
                          off && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <input
                          type="radio"
                          name="size"
                          className="peer sr-only"
                          checked={on}
                          disabled={off}
                          onChange={() => setSizeId(variant.id)}
                        />
                        <Radio on={on} />
                        <span className="flex-1 font-medium">
                          {variant.name}
                          {off && (
                            <span className="ml-2 text-sm font-normal text-foreground/55">
                              Sold out
                            </span>
                          )}
                        </span>
                        <span className="text-right tabular-nums">
                          <span
                            className={cn(
                              "font-semibold",
                              variant.salePrice !== undefined && "text-primary",
                            )}
                          >
                            {
                              formatMoney(
                                variant.salePrice ?? variant.price,
                                currency,
                              ).main
                            }
                          </span>
                          {variant.salePrice !== undefined && (
                            <span className="ml-1.5 text-sm text-foreground/45 line-through">
                              {formatMoney(variant.price, currency).main}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Options */}
            {dish.modifierGroups.map((group) => {
              const list = chosen[group.id] ?? [];
              const single = group.maxSelect === 1;
              const need = tried && list.length < group.minSelect;
              const rule =
                group.minSelect > 0
                  ? single
                    ? "Required"
                    : `Pick ${group.minSelect}${group.maxSelect > group.minSelect ? `–${group.maxSelect}` : ""}`
                  : single
                    ? "Optional"
                    : `Up to ${group.maxSelect}`;
              return (
                <fieldset key={group.id} className="mt-7">
                  <legend className="flex w-full items-center justify-between text-[15px] font-semibold">
                    {group.name}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        need
                          ? "bg-red-500/12 text-red-700 dark:text-red-300"
                          : group.minSelect > 0
                            ? "bg-primary/10 text-primary"
                            : "bg-foreground/[0.07] text-foreground/60",
                      )}
                    >
                      {rule}
                    </span>
                  </legend>
                  <div className="mt-3 divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
                    {group.options.map((option) => {
                      const off = option.isAvailable === false;
                      const on = list.includes(option.id);
                      const full =
                        !single && !on && list.length >= group.maxSelect;
                      return (
                        <label
                          key={option.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 px-3.5 py-3",
                            (off || full) && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <input
                            type={single ? "radio" : "checkbox"}
                            name={group.id}
                            className="sr-only"
                            checked={on}
                            disabled={off || full}
                            onChange={() =>
                              pick(group.id, option.id, group.maxSelect)
                            }
                          />
                          {single ? <Radio on={on} /> : <Check on={on} />}
                          <span className="flex-1">
                            {option.name}
                            {off && (
                              <span className="ml-2 text-sm text-foreground/55">
                                Sold out
                              </span>
                            )}
                          </span>
                          {option.priceDelta ? (
                            <span className="text-sm text-foreground/70 tabular-nums">
                              +{formatMoney(option.priceDelta, currency).main}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}

            {ordering && dish.isAvailable && (
              <div className="mt-7">
                <label
                  htmlFor="dish-note"
                  className="text-[15px] font-semibold"
                >
                  Special requests{" "}
                  <span className="font-normal text-foreground/50">
                    (optional)
                  </span>
                </label>
                <textarea
                  id="dish-note"
                  value={note}
                  onChange={(event) =>
                    setNote(event.target.value.slice(0, MAX_LINE_NOTE))
                  }
                  rows={2}
                  maxLength={MAX_LINE_NOTE}
                  placeholder="No onions, sauce on the side…"
                  className="mt-2.5 w-full resize-none rounded-2xl border border-foreground/15 bg-background px-3.5 py-3 text-[15px] outline-none transition placeholder:text-foreground/40 focus:border-primary/60 focus:ring-4 focus:ring-primary/15"
                />
              </div>
            )}

            {showAllergens && dish.allergens.length > 0 && (
              <div className="mt-7 rounded-2xl bg-foreground/4 p-4">
                <p className="text-sm font-semibold">Allergens</p>
                <p className="mt-1 text-sm text-foreground/70">
                  Contains {dish.allergens.map(allergenLabel).join(", ")}.
                </p>
                <p className="mt-2 text-xs text-foreground/50">
                  Tell your server about any allergy: dishes are prepared in a
                  kitchen that handles all of these.
                </p>
              </div>
            )}
          </div>
        </div>

        {ordering && (
          <div className="border-t border-foreground/10 bg-background px-5 pt-3.5 pb-[max(env(safe-area-inset-bottom),0.875rem)] sm:px-7">
            {!dish.isAvailable ? (
              <p className="py-2 text-center font-medium text-foreground/60">
                Sold out for now
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-full border border-foreground/15">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity === 1}
                    aria-label="One less"
                    className="grid size-11 place-items-center rounded-full transition hover:bg-foreground/5 disabled:opacity-35"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span
                    className="w-7 text-center font-semibold tabular-nums"
                    aria-live="polite"
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))
                    }
                    disabled={quantity >= MAX_LINE_QUANTITY}
                    aria-label="One more"
                    className="grid size-11 place-items-center rounded-full transition hover:bg-foreground/5"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    setTried(true);
                    if (missing.length > 0 || add.isPending) return;
                    const from = (
                      photo.current ?? event.currentTarget
                    ).getBoundingClientRect();
                    add.mutate(
                      {
                        itemId: dish.id,
                        variantId: size?.id,
                        optionIds: Object.values(chosen).flat(),
                        quantity,
                        note: note.trim() || undefined,
                        name: dish.name,
                        dish,
                      },
                      { onSuccess: () => flyToCart(from, src) },
                    );
                  }}
                  disabled={add.isPending}
                  aria-busy={add.isPending}
                  className="flex h-12 flex-1 items-center justify-between gap-3 rounded-full bg-primary pr-5 pl-5 font-semibold text-white shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--primary)_80%,transparent)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-80"
                >
                  <span className="inline-flex items-center gap-2">
                    {add.isPending ? (
                      <LoaderCircle className="size-4.5 animate-spin" />
                    ) : (
                      <ShoppingBag className="size-4.5" />
                    )}
                    {add.isPending ? "Adding…" : "Add to order"}
                  </span>
                  <span className="tabular-nums">
                    {baseWas !== undefined &&
                      quantity === 1 &&
                      extras === 0 && (
                        <span className="mr-2 text-sm font-normal line-through opacity-70">
                          {formatMoney(baseWas, currency).main}
                        </span>
                      )}
                    {formatMoney(total, currency).main}
                  </span>
                </button>
              </div>
            )}
            {tried && missing.length > 0 && (
              <p
                role="alert"
                className="mt-2 text-center text-sm font-medium text-red-700 dark:text-red-300"
              >
                Choose {missing.map((g) => g.name.toLowerCase()).join(" and ")}{" "}
                first.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DishTitleBadges({ dish }: { dish: PublicDish }) {
  if (!dish.isAvailable)
    return (
      <span className="rounded-full bg-foreground/10 px-2.5 py-0.5 text-sm font-semibold text-foreground/70">
        Sold out
      </span>
    );
  return (
    <>
      {dish.badges
        .filter((b) => BADGES[b])
        .map((b) => (
          <span
            key={b}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary"
          >
            {b === "new" ? (
              <Sparkles className="size-3.5" />
            ) : (
              <Star className="size-3.5" />
            )}
            {BADGES[b]}
          </span>
        ))}
    </>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
        on ? "border-primary" : "border-foreground/30",
      )}
    >
      {on && <span className="size-2.5 rounded-full bg-primary" />}
    </span>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-foreground/30",
      )}
    >
      {on && (
        <svg
          viewBox="0 0 12 12"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            d="M2 6.5 5 9l5-6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}
