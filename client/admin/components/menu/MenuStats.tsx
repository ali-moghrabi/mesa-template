import Link from "next/link";
import {
  CircleSlash,
  Eye,
  EyeOff,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { menuHref, type MenuFilters } from "@/admin/lib/menu/params";
import type { MenuSummary } from "@/admin/lib/menu/types";

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
