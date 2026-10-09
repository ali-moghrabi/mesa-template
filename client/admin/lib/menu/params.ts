export const MENU_PAGE_PATH = "/admin/menu";
export const MENU_PAGE_SIZE = 10;

export const SORT_OPTIONS = [
  { value: "", label: "Menu order" },
  { value: "relevance", label: "Best match" },
  { value: "name", label: "Name, A to Z" },
  { value: "price", label: "Price, low to high" },
  { value: "-price", label: "Price, high to low" },
  { value: "newest", label: "Newest first" },
] as const;

export type MenuSortValue = (typeof SORT_OPTIONS)[number]["value"];
export type StockFilter = "all" | "available" | "sold-out";
export type VisibilityFilter = "all" | "visible" | "hidden";

export type MenuFilters = {
  page: number;
  search: string;
  category: string;
  stock: StockFilter;
  visibility: VisibilityFilter;
  sort: MenuSortValue;
};

export const DEFAULT_FILTERS: MenuFilters = {
  page: 1,
  search: "",
  category: "",
  stock: "all",
  visibility: "all",
  sort: "",
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const cleanSearch = (value: string) =>
  value.replace(/\s+/g, " ").trim().slice(0, 80);

export function parseMenuFilters(params: RawParams): MenuFilters {
  const page = Number.parseInt(first(params.page), 10);
  const category = first(params.category);
  const stock = first(params.stock);
  const visibility = first(params.visibility);
  const sort = first(params.sort);

  return {
    page: Number.isFinite(page) && page >= 1 && page <= 10_000 ? page : 1,
    search: cleanSearch(first(params.q)),
    category: SLUG.test(category) ? category : "",
    stock: stock === "available" || stock === "sold-out" ? stock : "all",
    visibility:
      visibility === "visible" || visibility === "hidden" ? visibility : "all",
    sort: SORT_OPTIONS.some((o) => o.value === sort)
      ? (sort as MenuSortValue)
      : "",
  };
}

export function menuHref(
  current: MenuFilters,
  changes: Partial<MenuFilters> = {},
): string {
  const next: MenuFilters = { ...current, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.search) params.set("q", next.search);
  if (next.category) params.set("category", next.category);
  if (next.stock !== "all") params.set("stock", next.stock);
  if (next.visibility !== "all") params.set("visibility", next.visibility);
  if (next.sort) params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${MENU_PAGE_PATH}?${query}` : MENU_PAGE_PATH;
}

export function toApiQuery(filters: MenuFilters): URLSearchParams {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(MENU_PAGE_SIZE),
  });
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.stock !== "all")
    params.set("available", String(filters.stock === "available"));
  if (filters.visibility !== "all")
    params.set("visibility", filters.visibility);
  if (filters.sort) params.set("sort", filters.sort);
  return params;
}

export const hasActiveFilters = (f: MenuFilters) =>
  Boolean(
    f.search ||
    f.category ||
    f.stock !== "all" ||
    f.visibility !== "all" ||
    f.sort,
  );

export function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(current - 1, total - 4));
  const end = Math.min(total - 1, Math.max(current + 1, 5));
  const pages: (number | "…")[] = [1];
  if (start === 3) pages.push(2);
  else if (start > 3) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end === total - 2) pages.push(total - 1);
  else if (end < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}
