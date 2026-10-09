import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  SLUG_PATTERN,
  TIME_PATTERN,
  WEEK_DAYS,
  type WeekDay,
} from 'lib/constants/menuConstants';

/**
 * When a category is served, e.g. Breakfast: every day 07:00 to 11:30.
 * `to` earlier than `from` runs past midnight (22:00 to 02:00).
 */
@Schema({ _id: false })
export class ServingWindow {
  /** Empty = every day */
  @Prop({ type: [String], enum: WEEK_DAYS, default: [] })
  days!: WeekDay[];

  @Prop({ type: String, required: true, match: TIME_PATTERN })
  from!: string;

  @Prop({ type: String, required: true, match: TIME_PATTERN })
  to!: string;
}
export const ServingWindowSchema = SchemaFactory.createForClass(ServingWindow);

/** A section of the menu: Starters, Mains, Pizzas, Drinks... */
@Schema({ collection: 'menu_categories', timestamps: true })
export class MenuCategory {
  @Prop({ type: String, required: true, trim: true, maxlength: 60 })
  name!: string;

  /** Stable public id used in URLs (/menu#mains). Generated from the name, unique. */
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 80,
    match: SLUG_PATTERN,
  })
  slug!: string;

  @Prop({ type: String, trim: true, maxlength: 300 })
  description?: string;

  /** Path relative to the client's public folder, e.g. "assets/menu/mains.jpg" */
  @Prop({ type: String, trim: true })
  image?: string;

  /** Lower numbers come first */
  @Prop({ type: Number, default: 0 })
  sortOrder!: number;

  /** false = hidden from the website (seasonal menu kept for later) */
  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  /** When it is served. Empty = whenever the restaurant is open. */
  @Prop({ type: [ServingWindowSchema], default: [] })
  servingHours!: ServingWindow[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type MenuCategoryDocument = HydratedDocument<MenuCategory>;
export const MenuCategorySchema = SchemaFactory.createForClass(MenuCategory);

MenuCategorySchema.index({ isActive: 1, sortOrder: 1 });
