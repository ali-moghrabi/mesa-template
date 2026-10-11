import type { Types } from 'mongoose';
import { mediaUrl } from 'lib/media-url';
import { fromMinor } from 'lib/money';
import type { Pricing } from 'src/features/promotions/promotions.service';
import type { MenuItem, ModifierGroup, Variant } from 'src/schemas/item.schema';

export type MenuItemRow = MenuItem & {
  _id: Types.ObjectId;
  category: {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    sortOrder: number;
    isActive: boolean;
  };
};

const money = fromMinor;

export function toPublicMenuItem(row: MenuItemRow, pricing?: Pricing) {
  const sale =
    pricing?.saleFor({
      id: String(row._id),
      categoryId: String(row.categoryId),
    }) ?? null;
  return {
    id: String(row._id),
    slug: row.slug,
    name: row.name,
    description: row.description,
    image: mediaUrl(row.image),
    imageBlur: row.imageBlur,
    category: { slug: row.category.slug, name: row.category.name },
    price: money(row.price),
    salePrice: sale ? money(sale.price(row.price)) : undefined,
    compareAtPrice: sale ? undefined : money(row.compareAtPrice),
    sale: sale?.info,
    variants: (row.variants ?? []).map((v: Variant) => ({
      id: String(v._id),
      name: v.name,
      price: money(v.price),
      salePrice: sale ? money(sale.price(v.price)) : undefined,
      isDefault: v.isDefault,
      isAvailable: v.isAvailable,
    })),
    modifierGroups: (row.modifierGroups ?? []).map((g: ModifierGroup) => ({
      id: String(g._id),
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      options: g.options.map((o) => ({
        id: String(o._id),
        name: o.name,
        priceDelta: money(o.priceDelta),
        isDefault: o.isDefault,
        isAvailable: o.isAvailable,
      })),
    })),
    dietaryTags: row.dietaryTags ?? [],
    allergens: row.allergens ?? [],
    spiceLevel: row.spiceLevel ?? 0,
    badges: row.badges ?? [],
    calories: row.calories,
    prepTimeMinutes: row.prepTimeMinutes,
    isAvailable: row.isAvailable,
  };
}

export function toAdminMenuItem(row: MenuItemRow, pricing?: Pricing) {
  return {
    ...toPublicMenuItem(row, pricing),
    category: {
      slug: row.category.slug,
      name: row.category.name,
      isActive: row.category.isActive,
    },
    isActive: row.isActive,
    isVisible: row.isActive && row.category.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type PublicMenuItem = ReturnType<typeof toPublicMenuItem>;
export type AdminMenuItem = ReturnType<typeof toAdminMenuItem>;
