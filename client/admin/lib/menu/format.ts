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

export function displayPrice(item: Pick<AdminMenuItem, "price" | "variants">): {
  amount: number;
  from: boolean;
} {
  if (item.variants.length === 0) return { amount: item.price, from: false };
  const prices = item.variants.map((v) => v.price);
  const lowest = Math.min(...prices);
  return { amount: lowest, from: prices.some((p) => p !== lowest) };
}

export function mediaSrc(image: string | undefined | null): string | null {
  if (!image) return null;
  if (/^https?:\/\//i.test(image) || image.startsWith("/")) return image;
  return `/${image}`;
}

export const isRemote = (src: string) => /^https?:\/\//i.test(src);

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
