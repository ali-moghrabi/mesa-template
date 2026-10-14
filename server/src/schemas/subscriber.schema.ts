import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SubscriberDocument = HydratedDocument<Subscriber>;

export const SUBSCRIBER_STATUSES = [
  'pending',
  'subscribed',
  'unsubscribed',
] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

export const SUBSCRIBER_SOURCES = [
  'website',
  'footer',
  'popup',
  'admin',
  'import',
] as const;
export type SubscriberSource = (typeof SUBSCRIBER_SOURCES)[number];

@Schema({ _id: false })
export class Consent {
  @Prop({ type: Date, required: true }) at!: Date;
  @Prop({ type: String }) ip?: string;
  @Prop({ type: String }) userAgent?: string;
  @Prop({ type: String }) page?: string;
}
const ConsentSchema = SchemaFactory.createForClass(Consent);

@Schema({ collection: 'subscribers', timestamps: true })
export class Subscriber {
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email!: string;

  @Prop({
    type: String,
    enum: SUBSCRIBER_STATUSES,
    default: 'pending',
    index: true,
  })
  status!: SubscriberStatus;

  @Prop({ type: String, enum: SUBSCRIBER_SOURCES, default: 'website' })
  source!: SubscriberSource;

  @Prop({ type: ConsentSchema, required: true })
  consent!: Consent;

  @Prop({ type: String, index: true, sparse: true, select: false })
  confirmTokenHash?: string;

  @Prop({ type: Date })
  confirmExpiresAt?: Date;

  @Prop({ type: String, required: true, unique: true, select: false })
  unsubscribeToken!: string;

  @Prop({ type: Date }) confirmedAt?: Date;
  @Prop({ type: Date }) unsubscribedAt?: Date;
  @Prop({ type: String }) unsubscribeReason?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const SubscriberSchema = SchemaFactory.createForClass(Subscriber);
SubscriberSchema.index({ status: 1, createdAt: -1 });
