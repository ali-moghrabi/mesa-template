import "server-only";
import { cache } from "react";

export const MENU_TAG = "menu";

export type PublicDishSale = {
  id: string;
  name: string;
  percentOff: number;
  endsAt: string | null;
  timezone: string;
};

export type PublicDish = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image?: string;
  imageBlur?: string;
  category: { slug: string; name: string };
  price: number;
  salePrice?: number;
  compareAtPrice?: number;
  sale?: PublicDishSale;
  variants: {
    id: string;
    name: string;
    price: number;
    salePrice?: number;
    isDefault?: boolean;
    isAvailable?: boolean;
  }[];
  modifierGroups: {
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    options: {
      id: string;
      name: string;
      priceDelta?: number;
      isDefault?: boolean;
      isAvailable?: boolean;
    }[];
  }[];
  dietaryTags: string[];
  allergens: string[];
  spiceLevel: number;
  badges: string[];
  calories?: number;
  prepTimeMinutes?: number;
  isAvailable: boolean;
};

export type PublicMenuCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image?: string;
  imageBlur?: string;
  servingHours: { days: string[]; from: string; to: string }[];
  items: PublicDish[];
};

export type PublicMenu = {
  categories: PublicMenuCategory[];
  nextPriceChangeIn: number | null;
};

export type MenuResult =
  | { ok: true; menu: PublicMenu }
  | { ok: false; message: string };

export const getPublicMenu = cache(async (): Promise<MenuResult> => {
  const base = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ""
  ).replace(/\/+$/, "");
  if (!base)
    return {
      ok: false,
      message: "The menu isn't connected yet (API_URL is not set).",
    };
  try {
    const response = await fetch(`${base}/menu`, {
      next: { tags: [MENU_TAG], revalidate: 60 },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok)
      return { ok: false, message: "The menu couldn't be loaded right now." };
    return { ok: true, menu: (await response.json()) as PublicMenu };
  } catch (error) {
    console.error("[menu] API unavailable:", error);
    return { ok: false, message: "The menu couldn't be loaded right now." };
  }
});

const HIGHLIGHT_BADGES = [
  "popular",
  "signature",
  "chefs-pick",
  "new",
  "seasonal",
  "limited",
];

export function pickHighlights(
  categories: PublicMenuCategory[],
  limit = 6,
  pinned: string[] = [],
): PublicDish[] {
  const dishes = categories
    .flatMap((c) => c.items)
    .filter((d) => d.isAvailable);
  const chosen: PublicDish[] = [];
  const taken = new Set<string>();
  const take = (d: PublicDish) => {
    if (chosen.length < limit && !taken.has(d.id)) {
      chosen.push(d);
      taken.add(d.id);
    }
  };

  for (const key of pinned) {
    const dish = dishes.find((d) => d.slug === key || d.id === key);
    if (dish) take(dish);
  }

  const rank = (d: PublicDish) => {
    const badge = Math.min(
      ...d.badges.map((b) => HIGHLIGHT_BADGES.indexOf(b)).filter((i) => i >= 0),
    );
    return Number.isFinite(badge)
      ? badge
      : d.sale
        ? HIGHLIGHT_BADGES.length
        : Infinity;
  };
  const photoFirst = (a: PublicDish, b: PublicDish) =>
    Number(!a.image) - Number(!b.image);
  dishes
    .filter((d) => rank(d) !== Infinity)
    .sort((a, b) => rank(a) - rank(b) || photoFirst(a, b))
    .forEach(take);

  const queues = categories.map((c) =>
    c.items.filter((d) => d.isAvailable && !taken.has(d.id)).sort(photoFirst),
  );
  while (chosen.length < limit && queues.some((q) => q.length)) {
    for (const queue of queues) {
      const dish = queue.shift();
      if (dish) take(dish);
    }
  }
  return chosen;
}

export async function getMenuHighlights(
  limit = 6,
  pinned: string[] = [],
): Promise<PublicDish[]> {
  const result = await getPublicMenu();
  return result.ok ? pickHighlights(result.menu.categories, limit, pinned) : [];
}
