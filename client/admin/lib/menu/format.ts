import type { AdminMenuItem } from "./types";

const formatters = new Map<string, Intl.NumberFormat>();

export function formatPrice(value: number, currency: string): string {
  let formatter = formatters.get(currency);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      });
    } catch {
      formatter = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    formatters.set(currency, formatter);
  }
  return formatter.format(value);
}

export type PriceView = {
  amount: number;
  from: boolean;
  was?: number;
  percentOff?: number;
};

export function displayPrice(
  item: Pick<
    AdminMenuItem,
    "price" | "salePrice" | "compareAtPrice" | "variants" | "sale"
  >,
): PriceView {
  const rows = item.variants.length
    ? item.variants
    : [{ price: item.price, salePrice: item.salePrice }];
  const now = rows.map((r) => r.salePrice ?? r.price);
  const lowest = Math.min(...now);
  const cheapest = rows[now.indexOf(lowest)];
  const from = now.some((p) => p !== lowest);

  if (item.sale && cheapest.salePrice !== undefined) {
    return {
      amount: lowest,
      from,
      was: cheapest.price,
      percentOff: item.sale.percentOff,
    };
  }
  if (
    item.variants.length === 0 &&
    item.compareAtPrice != null &&
    item.compareAtPrice > item.price
  ) {
    return {
      amount: item.price,
      from: false,
      was: item.compareAtPrice,
      percentOff: Math.round((1 - item.price / item.compareAtPrice) * 100),
    };
  }
  return { amount: lowest, from };
}

export function mediaSrc(image: string | undefined | null): string | null {
  if (!image) return null;
  if (/^(https?:|blob:|data:)/i.test(image) || image.startsWith("/"))
    return image;
  return `/${image}`;
}

const MEDIA_URL = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");

export function canOptimize(src: string): boolean {
  if (src.startsWith("/")) return true;
  return MEDIA_URL !== "" && src.startsWith(`${MEDIA_URL}/`);
}

const LABELS: Record<string, string> = {
  "chefs-pick": "Chef's pick",
  "gluten-free": "Gluten free",
  "dairy-free": "Dairy free",
};
export function tagLabel(tag: string): string {
  if (LABELS[tag]) return LABELS[tag];
  const words = tag.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
