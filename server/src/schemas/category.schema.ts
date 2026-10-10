import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  SLUG_PATTERN,
  TIME_PATTERN,
  WEEK_DAYS,
  type WeekDay,
} from 'lib/constants/menuConstants';
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

@Schema({ collection: 'menu_categories', timestamps: true })
export class MenuCategory {
  @Prop({ type: String, required: true, trim: true, maxlength: 60 })
  name!: string;

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

  /** Cover photo: S3 key ("menu/….webp") or an older public-folder path. Turned into a URL by lib/media-url.ts */
  @Prop({ type: String, trim: true, maxlength: 300 })
  image?: string;

  /** Tiny blurred version of the cover (data URL) shown while it loads */
  @Prop({ type: String, maxlength: 2000 })
  imageBlur?: string;

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
