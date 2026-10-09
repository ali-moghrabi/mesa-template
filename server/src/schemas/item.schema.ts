import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  ALLERGENS,
  DIETARY_TAGS,
  MAX_SPICE_LEVEL,
  MENU_BADGES,
  SLUG_PATTERN,
  type Allergen,
  type DietaryTag,
  type MenuBadge,
} from 'lib/constants/menuConstants';
import { checkMenuItem } from 'lib/menu-rules';

/*
 * MONEY: every price is an integer in the smallest unit of the restaurant's primary currency
 * (cents for USD: 1450 = $14.50). Whole numbers never round wrong when an order adds them up.
 * The API converts to 14.5 when it sends a dish to the website.
 */
const money = {
  type: Number,
  min: 0,
  validate: {
    validator: Number.isInteger,
    message: 'Use whole cents (1450 = $14.50)',
  },
};

/* ───────────── variants: Small / Medium / Large, Glass / Bottle ───────────── */

/** Each variant has its own _id, so an order can say exactly which one was chosen. */
@Schema()
export class Variant {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 40 })
  name!: string;

  /** Full price of this variant (not a difference) */
  @Prop({ ...money, required: true })
  price!: number;

  /** Pre-selected when the guest opens the dish */
  @Prop({ type: Boolean, default: false })
  isDefault!: boolean;

  @Prop({ type: Boolean, default: true })
  isAvailable!: boolean;
}
export const VariantSchema = SchemaFactory.createForClass(Variant);

/* ───────────── modifiers: "Cooking" (pick 1), "Extras" (pick up to 3) ───────────── */

@Schema()
export class ModifierOption {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 40 })
  name!: string;

  /** Added to the price when chosen (0 for free choices such as "Medium rare") */
  @Prop({ ...money, default: 0 })
  priceDelta!: number;

  @Prop({ type: Boolean, default: false })
  isDefault!: boolean;

  @Prop({ type: Boolean, default: true })
  isAvailable!: boolean;
}
export const ModifierOptionSchema =
  SchemaFactory.createForClass(ModifierOption);

@Schema()
export class ModifierGroup {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 40 })
  name!: string;

  /** 0 = optional, 1+ = the guest must choose at least this many */
  @Prop({ type: Number, min: 0, default: 0 })
  minSelect!: number;

  /** 1 = a single choice (radio buttons), more = several (checkboxes) */
  @Prop({ type: Number, min: 1, default: 1 })
  maxSelect!: number;

  @Prop({ type: [ModifierOptionSchema], default: [] })
  options!: ModifierOption[];
}
export const ModifierGroupSchema = SchemaFactory.createForClass(ModifierGroup);

/* ───────────── the dish ───────────── */

@Schema({ collection: 'menu_items', timestamps: true })
export class MenuItem {
  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  name!: string;

  /**
   * Stable public id ("burrata-salad"). config.json refers to dishes by it
   * (menuPreview.itemIds), so it must never change once the dish is published.
   */
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 100,
    match: SLUG_PATTERN,
  })
  slug!: string;

  @Prop({ type: String, trim: true, maxlength: 500, default: '' })
  description!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'MenuCategory',
    required: true,
    index: true,
  })
  categoryId!: Types.ObjectId;

  /** Path relative to the client's public folder, e.g. "assets/menu/burrata.jpg" */
  @Prop({ type: String, trim: true })
  image?: string;

  /**
   * In cents. With variants it is set automatically to the cheapest one, so the menu can show "from $9".
   */
  @Prop({ ...money })
  price!: number;

  /** Old price, shown crossed out during a promotion. Must be higher than `price`. */
  @Prop({ ...money })
  compareAtPrice?: number;

  @Prop({ type: [VariantSchema], default: [] })
  variants!: Variant[];

  @Prop({ type: [ModifierGroupSchema], default: [] })
  modifierGroups!: ModifierGroup[];

  @Prop({ type: [String], enum: DIETARY_TAGS, default: [] })
  dietaryTags!: DietaryTag[];

  @Prop({ type: [String], enum: ALLERGENS, default: [] })
  allergens!: Allergen[];

  /** 0 = not spicy, 3 = hot */
  @Prop({ type: Number, min: 0, max: MAX_SPICE_LEVEL, default: 0 })
  spiceLevel!: number;

  @Prop({ type: [String], enum: MENU_BADGES, default: [] })
  badges!: MenuBadge[];

  @Prop({ type: Number, min: 0, max: 5000 })
  calories?: number;

  /** Helps the kitchen and the "ready in" estimate for online orders */
  @Prop({ type: Number, min: 0, max: 240 })
  prepTimeMinutes?: number;

  /** false = hidden from the website (draft, or removed from the menu but kept for order history) */
  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  /** false = still shown, marked "Sold out" (out of stock today). Staff flip this, not isActive. */
  @Prop({ type: Boolean, default: true })
  isAvailable!: boolean;

  /** Lower numbers come first inside the category */
  @Prop({ type: Number, default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MenuItemDocument = HydratedDocument<MenuItem>;
export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);

/* ───────────── indexes ───────────── */

// A category's dishes in order: the most common query
MenuItemSchema.index({ categoryId: 1, isActive: 1, sortOrder: 1 });
// Menu search box
MenuItemSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 5, description: 1 } },
);

/* ───────────── rules across several fields ───────────── */

MenuItemSchema.pre('validate', function () {
  // Remove repeated tags ("vegan", "vegan")
  this.dietaryTags = [...new Set(this.dietaryTags)];
  this.allergens = [...new Set(this.allergens)];
  this.badges = [...new Set(this.badges)];

  const { issues, price } = checkMenuItem({
    price: this.price,
    compareAtPrice: this.compareAtPrice,
    variants: this.variants,
    modifierGroups: this.modifierGroups,
  });

  if (price !== undefined) this.price = price;
  for (const issue of issues) this.invalidate(issue.path, issue.message);
});
