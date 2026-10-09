import { Flame, Leaf, Sparkles, Star, WheatOff } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { tagLabel } from "@/admin/lib/menu/format";
import type { AdminMenuItem } from "@/admin/lib/menu/types";

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
