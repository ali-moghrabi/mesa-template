import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TrustedDeviceDocument = HydratedDocument<TrustedDevice>;

@Schema({
  collection: 'trusted_devices',
  timestamps: { createdAt: true, updatedAt: false },
})
export class TrustedDevice {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  tokenHash!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ type: String, maxlength: 300 })
  userAgent?: string;

  @Prop({ type: String, maxlength: 64 })
  ip?: string;

  createdAt?: Date;
}

export const TrustedDeviceSchema = SchemaFactory.createForClass(TrustedDevice);
TrustedDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
