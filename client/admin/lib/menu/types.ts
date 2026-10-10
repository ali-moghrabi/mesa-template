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
  imageBlur?: string;
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

export type UploadedImage = {
  key: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  blurDataURL: string;
};

export type AdminMenuCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image?: string;
  imageBlur?: string;
  sortOrder: number;
  isActive: boolean;
  servingHours: { days: string[]; from: string; to: string }[];
  itemCount: number;
  soldOutCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminMenuItemDetail = AdminMenuItem & {
  neighbors: {
    position: number;
    total: number;
    previous?: { slug: string; name: string };
    next?: { slug: string; name: string };
  };
};
