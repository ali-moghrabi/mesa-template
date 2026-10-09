export type MenuVariant = {
  id: string;
  name: string;
  price: number;
  isDefault?: boolean;
  isAvailable?: boolean;
};

export type MenuModifierGroup = {
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
};

export type AdminMenuItem = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image?: string;
  category: { slug: string; name: string; isActive: boolean };
  price: number;
  compareAtPrice?: number;
  variants: MenuVariant[];
  modifierGroups: MenuModifierGroup[];
  dietaryTags: string[];
  allergens: string[];
  spiceLevel: number;
  badges: string[];
  calories?: number;
  prepTimeMinutes?: number;
  isAvailable: boolean;
  isActive: boolean;
  isVisible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type Paginated<T> = { items: T[]; meta: PaginationMeta };

export type MenuSummary = {
  totals: { all: number; visible: number; hidden: number; soldOut: number };
  categories: {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    itemCount: number;
  }[];
};
