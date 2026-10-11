import { z } from "zod";
import type { AdminMenuItem } from "./types";

export const DIETARY_TAGS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "halal",
  "kosher",
] as const;
export const ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "dairy",
  "tree-nuts",
  "celery",
  "mustard",
  "sesame",
  "sulfites",
  "lupin",
  "molluscs",
] as const;
export const MENU_BADGES = [
  "chefs-pick",
  "new",
  "popular",
  "signature",
  "seasonal",
  "limited",
] as const;
export const SPICE_LEVELS = ["None", "Mild", "Medium", "Hot"] as const;

export const PRICE_DECIMALS = 2;
export const MAX_PRICE = 1_000_000;
export const MAX_VARIANTS = 10;
export const MAX_GROUPS = 10;
export const MAX_OPTIONS = 30;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(["new", "edit", "categories", "promotions"]);

const hasAtMostDecimals = (value: number) =>
  Math.abs(
    value * 10 ** PRICE_DECIMALS - Math.round(value * 10 ** PRICE_DECIMALS),
  ) < 1e-6;

const money = z
  .number({ message: "Enter a price" })
  .min(0, "Can't be negative")
  .max(MAX_PRICE, "That's a lot. Check the amount")
  .refine(hasAtMostDecimals, `At most ${PRICE_DECIMALS} decimals`);

const shortName = z
  .string()
  .trim()
  .min(1, "Give it a name")
  .max(40, "40 characters at most");

const existingId = z.string().optional();

const variantSchema = z.object({
  id: existingId,
  name: shortName,
  price: money,
  isDefault: z.boolean(),
  isAvailable: z.boolean(),
});

const optionSchema = z.object({
  id: existingId,
  name: shortName,
  priceDelta: money,
  isDefault: z.boolean(),
  isAvailable: z.boolean(),
});

const groupSchema = z.object({
  id: existingId,
  name: shortName,
  minSelect: z.number().int().min(0).max(MAX_OPTIONS),
  maxSelect: z.number().int().min(1, "At least 1").max(MAX_OPTIONS),
  options: z.array(optionSchema).max(MAX_OPTIONS),
});

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export const menuItemFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Give the dish a name")
      .max(80, "80 characters at most"),
    slug: z
      .string()
      .trim()
      .max(100, "100 characters at most")
      .refine(
        (v) => v === "" || SLUG.test(v),
        'Lowercase letters, numbers and dashes, like "basque-cheesecake"',
      )
      .refine((v) => !RESERVED_SLUGS.has(v), "This one is reserved"),
    description: z.string().trim().max(500, "500 characters at most"),
    categoryId: z.string().min(1, "Pick a category"),
    image: z.string().nullable(),
    price: money.optional(),
    compareAtPrice: money.optional(),
    variants: z.array(variantSchema).max(MAX_VARIANTS),
    modifierGroups: z.array(groupSchema).max(MAX_GROUPS),
    dietaryTags: z.array(z.enum(DIETARY_TAGS)),
    allergens: z.array(z.enum(ALLERGENS)),
    badges: z.array(z.enum(MENU_BADGES)),
    spiceLevel: z.number().int().min(0).max(3),
    calories: z
      .number()
      .int("Whole number")
      .min(0)
      .max(5000, "5000 at most")
      .optional(),
    prepTimeMinutes: z
      .number()
      .int("Whole minutes")
      .min(0)
      .max(240, "4 hours at most")
      .optional(),
    isActive: z.boolean(),
    isAvailable: z.boolean(),
  })
  .superRefine((item, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    if (item.variants.length === 1)
      issue(["variants"], "Add a second size, or switch back to one price");
    item.variants.forEach((variant, i) => {
      if (
        item.variants.findIndex((other) => sameName(other.name, variant.name)) <
        i
      )
        issue(["variants", i, "name"], "Two sizes have this name");
    });
    if (item.variants.length === 0 && item.price === undefined)
      issue(["price"], "Enter a price");

    const lowest = item.variants.length
      ? Math.min(...item.variants.map((v) => v.price))
      : item.price;
    if (
      item.compareAtPrice !== undefined &&
      lowest !== undefined &&
      item.compareAtPrice <= lowest
    )
      issue(["compareAtPrice"], "Must be higher than the price");

    item.modifierGroups.forEach((group, g) => {
      if (
        item.modifierGroups.findIndex((other) =>
          sameName(other.name, group.name),
        ) < g
      )
        issue(["modifierGroups", g, "name"], "Two groups have this name");

      const count = group.options.length;
      const available = group.options.filter((o) => o.isAvailable).length;
      if (count === 0)
        issue(["modifierGroups", g, "options"], "Add at least one option");
      if (group.minSelect > group.maxSelect)
        issue(
          ["modifierGroups", g, "minSelect"],
          "Can't be more than the maximum",
        );
      if (count > 0 && group.maxSelect > count)
        issue(
          ["modifierGroups", g, "maxSelect"],
          `Only ${count} option${count === 1 ? "" : "s"}`,
        );
      if (count > 0 && group.minSelect > available)
        issue(
          ["modifierGroups", g, "minSelect"],
          "More than the options available",
        );
      if (group.options.filter((o) => o.isDefault).length > group.maxSelect)
        issue(
          ["modifierGroups", g, "options"],
          "More pre-selected options than guests may pick",
        );
      group.options.forEach((option, o) => {
        if (
          group.options.findIndex((other) =>
            sameName(other.name, option.name),
          ) < o
        )
          issue(
            ["modifierGroups", g, "options", o, "name"],
            "Two options have this name",
          );
      });
    });
  });

export type MenuItemFormValues = z.infer<typeof menuItemFormSchema>;
export type VariantValues = MenuItemFormValues["variants"][number];
export type ModifierGroupValues = MenuItemFormValues["modifierGroups"][number];

export const emptyMenuItem = (categoryId = ""): MenuItemFormValues => ({
  name: "",
  slug: "",
  description: "",
  categoryId,
  image: null,
  price: undefined,
  compareAtPrice: undefined,
  variants: [],
  modifierGroups: [],
  dietaryTags: [],
  allergens: [],
  badges: [],
  spiceLevel: 0,
  calories: undefined,
  prepTimeMinutes: undefined,
  isActive: true,
  isAvailable: true,
});

export const newVariant = (name = "", isDefault = false): VariantValues => ({
  name,
  price: 0,
  isDefault,
  isAvailable: true,
});
export const newOption = (
  name = "",
): ModifierGroupValues["options"][number] => ({
  name,
  priceDelta: 0,
  isDefault: false,
  isAvailable: true,
});
export const newGroup = (name = ""): ModifierGroupValues => ({
  name,
  minSelect: 0,
  maxSelect: 1,
  options: [newOption()],
});

export function toCreatePayload(values: MenuItemFormValues) {
  const hasSizes = values.variants.length > 0;
  return {
    name: values.name,
    ...(values.slug && { slug: values.slug }),
    ...(values.description && { description: values.description }),
    categoryId: values.categoryId,
    ...(values.image && { image: values.image }),
    ...(!hasSizes && values.price !== undefined && { price: values.price }),
    ...(values.compareAtPrice !== undefined && {
      compareAtPrice: values.compareAtPrice,
    }),
    variants: values.variants,
    modifierGroups: values.modifierGroups,
    dietaryTags: values.dietaryTags,
    allergens: values.allergens,
    badges: values.badges,
    spiceLevel: values.spiceLevel,
    ...(values.calories !== undefined && { calories: values.calories }),
    ...(values.prepTimeMinutes !== undefined && {
      prepTimeMinutes: values.prepTimeMinutes,
    }),
    isActive: values.isActive,
    isAvailable: values.isAvailable,
  };
}

export function previewSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return RESERVED_SLUGS.has(base) ? `${base}-item` : base;
}

export function toItemFormValues(
  item: AdminMenuItem,
  categoryId: string,
): MenuItemFormValues {
  return {
    name: item.name,
    slug: item.slug,
    description: item.description ?? "",
    categoryId,
    image: item.image ?? null,
    price: item.variants.length ? undefined : item.price,
    compareAtPrice: item.compareAtPrice ?? undefined,
    variants: item.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      isDefault: v.isDefault ?? false,
      isAvailable: v.isAvailable ?? true,
    })),
    modifierGroups: item.modifierGroups.map((g) => ({
      id: g.id,
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceDelta: o.priceDelta ?? 0,
        isDefault: o.isDefault ?? false,
        isAvailable: o.isAvailable ?? true,
      })),
    })),
    dietaryTags: item.dietaryTags.filter(
      (t): t is (typeof DIETARY_TAGS)[number] =>
        (DIETARY_TAGS as readonly string[]).includes(t),
    ),
    allergens: item.allergens.filter((a): a is (typeof ALLERGENS)[number] =>
      (ALLERGENS as readonly string[]).includes(a),
    ),
    badges: item.badges.filter((b): b is (typeof MENU_BADGES)[number] =>
      (MENU_BADGES as readonly string[]).includes(b),
    ),
    spiceLevel: item.spiceLevel,
    calories: item.calories ?? undefined,
    prepTimeMinutes: item.prepTimeMinutes ?? undefined,
    isActive: item.isActive,
    isAvailable: item.isAvailable,
  };
}

export type EditOrigin = { image: string | null; version: string };

export function toUpdatePayload(
  values: MenuItemFormValues,
  origin: EditOrigin,
) {
  const rest = toCreatePayload({ ...values, image: null });
  const photo =
    values.image === origin.image
      ? {}
      : values.image === null
        ? { removeImage: true }
        : values.image.startsWith("tmp/")
          ? { image: values.image }
          : {};
  return { ...rest, ...photo, version: origin.version };
}
