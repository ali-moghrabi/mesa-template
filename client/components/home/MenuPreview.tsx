import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Flame,
  Leaf,
  Sprout,
  Star,
  UtensilsCrossed,
  WheatOff,
} from "lucide-react";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import { cn } from "@/lib/utils";
import { canOptimize, mediaSrc } from "@/admin/lib/menu/format";
import { formatMoney, type CurrencyConfig } from "@/lib/menu/money";
import { getMenuHighlights, type PublicDish } from "@/lib/menu/public-menu";
import { MenuPreviewRail } from "./MenuPreviewRail";

export const MENU_PREVIEW_VARIANTS = ["grid", "list", "carousel"] as const;
export type MenuPreviewVariant = (typeof MENU_PREVIEW_VARIANTS)[number];

const sectionSchema = z.object({
  id: z.string().catch("menu-preview"),
  variant: z.enum(MENU_PREVIEW_VARIANTS).catch("grid"),
  enabled: z.boolean().catch(true),
  props: z
    .object({
      title: z.string().catch("Favourites from our kitchen"),
      subtitle: z.string().optional().catch(undefined),
      itemIds: z.array(z.string()).catch([]),
      limit: z.number().int().min(1).max(12).catch(6),
      cta: z
        .object({ label: z.string(), href: z.string() })
        .catch({ label: "See the full menu", href: "/menu" }),
    })
    .catch({
      title: "Favourites from our kitchen",
      itemIds: [],
      limit: 6,
      cta: { label: "See the full menu", href: "/menu" },
    }),
});

type Section = z.infer<typeof sectionSchema>;

type Props = {
  section?: unknown;
};

function homeSection(): unknown {
  const pages = (
    getConfig() as unknown as {
      pages?: { home?: { sections?: { type?: string }[] } };
    }
  ).pages;
  return pages?.home?.sections?.find((s) => s?.type === "menuPreview") ?? {};
}

export default async function MenuPreview({ section }: Props) {
  const config = sectionSchema.parse(section ?? homeSection());
  if (!config.enabled) return null;

  const dishes = await getMenuHighlights(
    config.props.limit,
    config.props.itemIds,
  );
  if (dishes.length === 0) return null;
  const { currency } = getConfig().menu;

  return (
    <section
      id={config.id}
      aria-labelledby={`${config.id}-title`}
      className="px-(--pad) py-20 [--pad:clamp(1.1rem,4vw,3.5rem)] sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        {config.variant === "list" ? (
          <ListLook config={config} dishes={dishes} currency={currency} />
        ) : config.variant === "carousel" ? (
          <CarouselLook config={config} dishes={dishes} currency={currency} />
        ) : (
          <GridLook config={config} dishes={dishes} currency={currency} />
        )}
      </div>
    </section>
  );
}

type LookProps = {
  config: Section;
  dishes: PublicDish[];
  currency: CurrencyConfig;
};

function Heading({
  config,
  className,
}: {
  config: Section;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
        Our menu
      </p>
      <h2
        id={`${config.id}-title`}
        className="mt-3 text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] font-medium tracking-[-0.04em] text-balance"
      >
        {config.props.title}
      </h2>
      {config.props.subtitle && (
        <p className="mt-4 text-lg text-pretty text-foreground/70">
          {config.props.subtitle}
        </p>
      )}
    </div>
  );
}

function CtaLink({
  config,
  className,
}: {
  config: Section;
  className?: string;
}) {
  return (
    <Link
      href={config.props.cta.href}
      className={cn(
        "group h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-foreground/20 px-6 font-semibold transition-colors hover:border-foreground hover:bg-foreground hover:text-background",
        className,
      )}
    >
      {config.props.cta.label}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

const BADGES: Record<string, string> = {
  popular: "Popular",
  signature: "Signature",
  "chefs-pick": "Chef's pick",
  new: "New",
  seasonal: "Seasonal",
  limited: "Limited",
};

const DIETS: { tag: string; label: string; icon: typeof Leaf }[] = [
  { tag: "vegan", label: "Vegan", icon: Sprout },
  { tag: "vegetarian", label: "Vegetarian", icon: Leaf },
  { tag: "gluten-free", label: "Gluten free", icon: WheatOff },
];

function priceOf(dish: PublicDish, currency: CurrencyConfig) {
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
  return {
    now: formatMoney(lowest, currency),
    from: now.some((p) => p !== lowest),
    was: was !== undefined ? formatMoney(was, currency).main : null,
  };
}

function Price({
  dish,
  currency,
  light,
  className,
}: {
  dish: PublicDish;
  currency: CurrencyConfig;
  light?: boolean;
  className?: string;
}) {
  const price = priceOf(dish, currency);
  return (
    <div className={cn("shrink-0 text-right tabular-nums", className)}>
      <p className="text-lg leading-snug font-semibold whitespace-nowrap">
        {price.from && (
          <span
            className={cn(
              "mr-1 text-xs font-normal",
              light ? "text-white/70" : "text-foreground/55",
            )}
          >
            from
          </span>
        )}
        {price.was && (
          <s
            className={cn(
              "mr-1.5 text-sm font-normal",
              light ? "text-white/60" : "text-foreground/45",
            )}
          >
            {price.was}
          </s>
        )}
        <span className={cn(price.was && !light && "text-primary")}>
          {price.now.main}
        </span>
      </p>
      {price.now.sub && (
        <p
          className={cn(
            "text-xs",
            light ? "text-white/65" : "text-foreground/50",
          )}
        >
          {price.now.sub}
        </p>
      )}
    </div>
  );
}

function Tags({
  dish,
  soft,
  className,
}: {
  dish: PublicDish;
  soft?: boolean;
  className?: string;
}) {
  const badge = dish.badges.map((b) => BADGES[b]).find(Boolean);
  if (!dish.sale && !badge) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {dish.sale && (
        <span
          title={dish.sale.name}
          className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground tabular-nums shadow-sm"
        >
          −{dish.sale.percentOff}%
          <span className="sr-only"> off: {dish.sale.name}</span>
        </span>
      )}
      {badge && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-foreground",
            soft
              ? "bg-foreground/[0.07]"
              : "bg-background/90 shadow-sm backdrop-blur",
          )}
        >
          {(dish.badges.includes("popular") ||
            dish.badges.includes("chefs-pick")) && (
            <Star className="size-3 fill-current text-primary" />
          )}
          {badge}
        </span>
      )}
    </div>
  );
}

function Marks({ dish, className }: { dish: PublicDish; className?: string }) {
  const diet = DIETS.find((d) => dish.dietaryTags.includes(d.tag));
  if (!diet && dish.spiceLevel === 0) return null;
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-sm text-foreground/60",
        className,
      )}
    >
      {diet && (
        <span className="inline-flex items-center gap-1">
          <diet.icon className="size-3.5 text-green-600 dark:text-green-400" />
          {diet.label}
        </span>
      )}
      {dish.spiceLevel > 0 && (
        <span
          className="inline-flex items-center text-red-600 dark:text-red-400"
          aria-label={`Spicy, level ${dish.spiceLevel}`}
        >
          {Array.from({ length: Math.min(dish.spiceLevel, 3) }, (_, i) => (
            <Flame key={i} className="size-3.5" />
          ))}
        </span>
      )}
    </p>
  );
}

/*
 * `sizes` = how wide the photo is DRAWN, not how wide its box is. object-cover fills the box by its
 * height when the box is taller than the photo: a usual 4:3 dish photo in a 4:5 (portrait) card is
 * drawn ~1.67× the card's width. Asking for less makes the browser stretch a too-small file (blurry).
 */
function Photo({
  dish,
  sizes,
  priority,
  className,
}: {
  dish: PublicDish;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = mediaSrc(dish.image);
  if (!src) {
    return (
      <span className="absolute inset-0 grid place-items-center bg-foreground/6 text-foreground/25">
        <UtensilsCrossed className="size-1/4 max-h-10 max-w-10" />
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={dish.name}
      fill
      priority={priority}
      sizes={sizes}
      // Our photos are already compressed once by the API: Next's default 75 visibly smears them
      quality={90}
      placeholder={dish.imageBlur ? "blur" : "empty"}
      blurDataURL={dish.imageBlur}
      unoptimized={!canOptimize(src)}
      className={cn(
        "object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]",
        className,
      )}
    />
  );
}

const dishHref = (dish: PublicDish) => `/menu#${dish.category.slug}`;
const CARD_LINK =
  "group block rounded-[calc(var(--radius)*2)] outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary";

function GridLook({ config, dishes, currency }: LookProps) {
  return (
    <>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <Heading config={config} />
        <CtaLink config={config} className="hidden sm:inline-flex" />
      </header>

      <ul className="-mx-(--pad) mt-10 flex snap-x snap-mandatory scroll-px-(--pad) gap-4 overflow-x-auto px-(--pad) pb-2 scrollbar-none sm:mx-0 sm:mt-12 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        {dishes.map((dish, i) => (
          <li
            key={dish.id}
            className="w-[78%] max-w-80 shrink-0 snap-start sm:w-auto sm:max-w-none"
          >
            <Link href={dishHref(dish)} className={CARD_LINK}>
              <div className="relative aspect-4/3 overflow-hidden rounded-[calc(var(--radius)*2)] bg-foreground/6">
                <Photo
                  dish={dish}
                  priority={i < 3}
                  sizes="(min-width: 1024px) 370px, (min-width: 640px) 50vw, 78vw"
                />
                <Tags dish={dish} className="absolute inset-x-3 top-3" />
                <span
                  aria-hidden="true"
                  className="absolute right-3 bottom-3 grid size-10 translate-y-1 place-items-center rounded-full bg-background/90 text-foreground opacity-0 shadow-md backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                >
                  <ArrowUpRight className="size-4.5" />
                </span>
              </div>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-foreground/50 uppercase">
                    {dish.category.name}
                  </p>
                  <h3 className="mt-1 text-lg leading-snug font-semibold text-balance underline-offset-4 group-hover:underline">
                    {dish.name}
                  </h3>
                </div>
                <Price dish={dish} currency={currency} className="pt-4" />
              </div>
              {dish.description && (
                <p className="mt-2 line-clamp-2 text-[15px] text-pretty text-foreground/65">
                  {dish.description}
                </p>
              )}
              <Marks dish={dish} className="mt-3" />
            </Link>
          </li>
        ))}
      </ul>

      <CtaLink config={config} className="mt-8 flex w-full sm:hidden" />
    </>
  );
}

function ListLook({ config, dishes, currency }: LookProps) {
  const featured = dishes.find((d) => d.image) ?? dishes[0];
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <div className="lg:sticky lg:top-[calc(var(--nav-height,4.5rem)+2rem)] lg:self-start">
        <Heading config={config} />
        <CtaLink config={config} className="mt-8 hidden lg:inline-flex" />

        <Link
          href={dishHref(featured)}
          className={cn(CARD_LINK, "mt-10 hidden lg:block")}
        >
          <div className="relative aspect-4/5 overflow-hidden rounded-[calc(var(--radius)*2)] bg-foreground/6">
            <Photo
              dish={featured}
              priority
              sizes="(min-width: 1024px) 740px, 0px"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent"
            />
            <Tags dish={featured} className="absolute inset-x-4 top-4" />
            <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 text-white">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-[0.16em] text-white/70 uppercase">
                  Today&apos;s pick
                </p>
                <p className="mt-1 text-xl leading-snug font-semibold text-balance">
                  {featured.name}
                </p>
              </div>
              <Price dish={featured} currency={currency} light />
            </div>
          </div>
        </Link>
      </div>

      <div>
        <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
          {dishes.map((dish, i) => (
            <li key={dish.id}>
              <Link
                href={dishHref(dish)}
                className="group -mx-3 flex gap-4 rounded-[calc(var(--radius)*1.4)] px-3 py-5 transition-colors hover:bg-foreground/3 sm:gap-5 sm:py-6"
              >
                <div className="relative size-20 shrink-0 overflow-hidden rounded-[calc(var(--radius)*1.4)] bg-foreground/6 sm:size-24">
                  <Photo dish={dish} priority={i < 2} sizes="192px" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <h3 className="min-w-0 text-lg leading-snug font-semibold underline-offset-4 group-hover:underline">
                      {dish.name}
                    </h3>
                    <span
                      aria-hidden="true"
                      className="hidden min-w-6 flex-1 translate-y-[-0.3em] border-b border-dotted border-foreground/25 sm:block"
                    />
                    <Price
                      dish={dish}
                      currency={currency}
                      className="ml-auto sm:ml-0"
                    />
                  </div>
                  {dish.description && (
                    <p className="mt-1 line-clamp-2 text-[15px] text-pretty text-foreground/65">
                      {dish.description}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Tags dish={dish} soft />
                    <Marks dish={dish} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <CtaLink config={config} className="mt-8 flex w-full lg:hidden" />
      </div>
    </div>
  );
}

function CarouselLook({ config, dishes, currency }: LookProps) {
  return (
    <>
      <MenuPreviewRail header={<Heading config={config} />}>
        {dishes.map((dish, i) => (
          <li
            key={dish.id}
            className="w-[80%] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2.15)] lg:w-[calc((100%-2.5rem)/3.2)]"
          >
            <Link href={dishHref(dish)} className={CARD_LINK}>
              <div className="relative aspect-4/5 overflow-hidden rounded-[calc(var(--radius)*2)] bg-foreground/6">
                <Photo
                  dish={dish}
                  priority={i < 3}
                  sizes="(min-width: 1024px) 600px, (min-width: 640px) 77vw, 134vw"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent"
                />
                <Tags dish={dish} className="absolute inset-x-4 top-4" />
                <div className="absolute inset-x-5 bottom-5 text-white">
                  <p className="text-xs font-medium tracking-[0.16em] text-white/70 uppercase">
                    {dish.category.name}
                  </p>
                  <div className="mt-1 flex items-end justify-between gap-4">
                    <h3 className="min-w-0 text-xl leading-snug font-semibold text-balance underline-offset-4 group-hover:underline">
                      {dish.name}
                    </h3>
                    <Price dish={dish} currency={currency} light />
                  </div>
                  {dish.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-pretty text-white/75 sm:max-h-0 sm:opacity-0 sm:transition-all sm:duration-300 sm:group-hover:max-h-12 sm:group-hover:opacity-100 sm:group-focus-visible:max-h-12 sm:group-focus-visible:opacity-100">
                      {dish.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </MenuPreviewRail>
      <CtaLink
        config={config}
        className="mt-10 flex w-full sm:inline-flex sm:w-auto"
      />
    </>
  );
}
