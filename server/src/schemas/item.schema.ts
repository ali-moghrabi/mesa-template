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

const money = {
  type: Number,
  min: 0,
  validate: {
    validator: Number.isInteger,
    message: 'Use whole cents (1450 = $14.50)',
  },
};

@Schema()
export class Variant {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 40 })
  name!: string;

  @Prop({ ...money, required: true })
  price!: number;

  @Prop({ type: Boolean, default: false })
  isDefault!: boolean;

  @Prop({ type: Boolean, default: true })
  isAvailable!: boolean;
}
export const VariantSchema = SchemaFactory.createForClass(Variant);

@Schema()
export class ModifierOption {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 40 })
  name!: string;

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

  @Prop({ type: Number, min: 0, default: 0 })
  minSelect!: number;

  @Prop({ type: Number, min: 1, default: 1 })
  maxSelect!: number;

  @Prop({ type: [ModifierOptionSchema], default: [] })
  options!: ModifierOption[];
}
export const ModifierGroupSchema = SchemaFactory.createForClass(ModifierGroup);

@Schema({ collection: 'menu_items', timestamps: true })
export class MenuItem {
  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  name!: string;

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

  @Prop({ type: String, trim: true, maxlength: 300 })
  image?: string;

  @Prop({ type: String, maxlength: 2000 })
  imageBlur?: string;

  @Prop({ ...money })
  price!: number;

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

  @Prop({ type: Number, min: 0, max: MAX_SPICE_LEVEL, default: 0 })
  spiceLevel!: number;

  @Prop({ type: [String], enum: MENU_BADGES, default: [] })
  badges!: MenuBadge[];

  @Prop({ type: Number, min: 0, max: 5000 })
  calories?: number;

  @Prop({ type: Number, min: 0, max: 240 })
  prepTimeMinutes?: number;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: Boolean, default: true })
  isAvailable!: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MenuItemDocument = HydratedDocument<MenuItem>;
export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);

MenuItemSchema.index({ categoryId: 1, isActive: 1, sortOrder: 1 });
MenuItemSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 5, description: 1 } },
);

MenuItemSchema.pre('validate', function () {
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
