import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  ORDER_TYPES,
  PAYMENT_METHODS,
  type OrderType,
  type PaymentMethod,
} from 'lib/ordering';

export type OrderDocument = HydratedDocument<Order>;

export const ORDER_STATUSES = [
  'awaiting_payment',
  'placed',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'unpaid',
  'pending',
  'paid',
  'failed',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

@Schema({ _id: false })
export class OrderLine {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  itemId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  variantId?: Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  optionIds!: Types.ObjectId[];

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String })
  image?: string;

  @Prop({ type: String })
  variantName?: string;

  @Prop({ type: [String], default: [] })
  options!: string[];

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: 0 })
  unitPrice!: number;

  @Prop({ type: Number })
  unitWas?: number;

  @Prop({ type: Number, required: true, min: 0 })
  total!: number;

  @Prop({ type: String, default: '' })
  note!: string;
}
const OrderLineSchema = SchemaFactory.createForClass(OrderLine);

@Schema({ _id: false })
export class OrderAmounts {
  @Prop({ type: Number, required: true }) subtotal!: number;
  @Prop({ type: Number, default: 0 }) savings!: number;
  @Prop({ type: Number, default: 0 }) deliveryFee!: number;
  @Prop({ type: Number, default: 0 }) deliveryWaived!: number;
  @Prop({ type: Number, default: 0 }) tip!: number;
  @Prop({ type: Number, default: 0 }) vat!: number;
  @Prop({ type: Boolean, default: true }) vatIncluded!: boolean;
  @Prop({ type: Number, default: 0 }) vatRate!: number;
  @Prop({ type: Number, default: 0 }) discount!: number;
  @Prop({ type: Number, required: true }) total!: number;
}
const OrderAmountsSchema = SchemaFactory.createForClass(OrderAmounts);

@Schema({ _id: false })
export class OrderPayment {
  @Prop({ type: String, enum: PAYMENT_METHODS, required: true })
  method!: PaymentMethod;

  @Prop({ type: String, enum: PAYMENT_STATUSES, default: 'unpaid' })
  status!: PaymentStatus;

  @Prop({ type: String })
  chargeId?: string;

  @Prop({ type: Number, default: 0 })
  attempts?: number;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: String })
  cardBrand?: string;

  @Prop({ type: String })
  cardLast4?: string;

  @Prop({ type: Number })
  cashChangeFor?: number;

  @Prop({ type: String })
  lastError?: string;

  @Prop({ type: Number })
  amountPaid?: number;

  @Prop({ type: Number, default: 0 })
  refunded!: number;

  @Prop({
    type: [
      { id: String, amount: Number, at: Date, by: String, reason: String },
    ],
    default: [],
    _id: false,
  })
  refunds!: {
    id: string;
    amount: number;
    at: Date;
    by: string;
    reason?: string;
  }[];
}
const OrderPaymentSchema = SchemaFactory.createForClass(OrderPayment);

@Schema({ _id: false })
export class OrderAddress {
  @Prop({ type: String }) areaId?: string;
  @Prop({ type: String }) area?: string;
  @Prop({ type: String, required: true }) street!: string;
  @Prop({ type: String, default: '' }) building!: string;
  @Prop({ type: String, default: '' }) floor!: string;
  @Prop({ type: String, default: '' }) apartment!: string;
  @Prop({ type: String, default: '' }) directions!: string;
}
const OrderAddressSchema = SchemaFactory.createForClass(OrderAddress);

@Schema({ _id: false })
export class OrderSchedule {
  @Prop({ type: Boolean, default: true }) asap!: boolean;
  @Prop({ type: String }) for?: string;
  @Prop({ type: Date, required: true }) from!: Date;
  @Prop({ type: Date, required: true }) to!: Date;
  @Prop({ type: String, required: true }) timezone!: string;
}
const OrderScheduleSchema = SchemaFactory.createForClass(OrderSchedule);

@Schema({ _id: false })
export class OrderEvent {
  @Prop({ type: String, required: true }) status!: string;
  @Prop({ type: Date, default: () => new Date() }) at!: Date;
  @Prop({ type: String }) by?: string;
  @Prop({ type: String }) note?: string;
}
const OrderEventSchema = SchemaFactory.createForClass(OrderEvent);

@Schema({ collection: 'orders', timestamps: true })
export class Order {
  @Prop({ type: String, required: true, unique: true })
  number!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: ORDER_STATUSES, required: true, index: true })
  status!: OrderStatus;

  @Prop({ type: String, enum: ORDER_TYPES, required: true })
  type!: OrderType;

  @Prop({ type: OrderPaymentSchema, required: true })
  payment!: OrderPayment;

  @Prop({ type: [OrderLineSchema], required: true })
  lines!: OrderLine[];

  @Prop({ type: OrderAmountsSchema, required: true })
  amounts!: OrderAmounts;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({
    type: { name: String, phone: String, email: String },
    required: true,
    _id: false,
  })
  customer!: { name: string; phone: string; email: string };

  @Prop({ type: OrderAddressSchema })
  address?: OrderAddress;

  @Prop({ type: OrderScheduleSchema, required: true })
  schedule!: OrderSchedule;

  @Prop({ type: String, default: '' })
  notes!: string;

  @Prop({ type: Boolean, default: false })
  cutlery!: boolean;

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  cartLineIds!: Types.ObjectId[];

  @Prop({ type: String, required: true, select: false })
  checksum!: string;

  @Prop({ type: String, required: true })
  idempotencyKey!: string;

  @Prop({ type: [OrderEventSchema], default: [] })
  history!: OrderEvent[];

  @Prop({ type: Date, index: true })
  placedAt?: Date;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ type: String })
  cancelReason?: string;

  @Prop({ type: String, default: '' })
  staffNote!: string;

  @Prop({ type: Date })
  editedAt?: Date;

  @Prop({ type: Date })
  confirmedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ 'payment.chargeId': 1 }, { sparse: true });
OrderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

@Schema({ collection: 'counters', versionKey: false })
export class Counter {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: Number, default: 0 })
  seq!: number;
}
export const CounterSchema = SchemaFactory.createForClass(Counter);
