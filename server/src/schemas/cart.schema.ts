import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CartDocument = HydratedDocument<Cart>;

export const MAX_LINE_QUANTITY = 20;
export const MAX_CART_LINES = 30;
export const MAX_LINE_NOTE = 140;

@Schema()
export class CartLine {
  _id!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  itemId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  variantId?: Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  optionIds!: Types.ObjectId[];

  @Prop({ type: Number, required: true, min: 1, max: MAX_LINE_QUANTITY })
  quantity!: number;

  @Prop({ type: String, trim: true, maxlength: MAX_LINE_NOTE, default: '' })
  note!: string;

  @Prop({ type: String, trim: true, maxlength: 80, default: '' })
  name!: string;

  @Prop({ type: Date, default: () => new Date() })
  addedAt!: Date;
}
export const CartLineSchema = SchemaFactory.createForClass(CartLine);

@Schema({ collection: 'carts', timestamps: true })
export class Cart {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: [CartLineSchema], default: [] })
  lines!: CartLine[];

  updatedAt?: Date;
}

export const CartSchema = SchemaFactory.createForClass(Cart);
