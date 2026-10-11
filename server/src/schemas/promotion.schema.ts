import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { PromotionScope, PromotionWindow } from 'lib/promotions';

export type PromotionDocument = HydratedDocument<Promotion>;

@Schema({ collection: 'promotions', timestamps: true })
export class Promotion {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 40 })
  name!: string;

  @Prop({ type: Number, required: true, min: 1, max: 90 })
  percentOff!: number;

  @Prop({ type: Number, default: 0 })
  roundTo!: number;

  @Prop({
    type: String,
    enum: ['menu', 'categories', 'dishes'],
    required: true,
  })
  scope!: PromotionScope;

  @Prop({ type: [Types.ObjectId], default: [] })
  categoryIds!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], default: [] })
  dishIds!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], default: [] })
  excludedDishIds!: Types.ObjectId[];

  @Prop({ type: String, default: null })
  startsAt!: string | null;

  @Prop({ type: String, default: null, index: true })
  endsAt!: string | null;

  @Prop({
    type: [{ _id: false, days: [String], from: String, to: String }],
    default: [],
  })
  windows!: PromotionWindow[];

  @Prop({ type: String, required: true })
  timezone!: string;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
