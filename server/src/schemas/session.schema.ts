import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ collection: 'sessions', timestamps: true })
export class Session {
  _id!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  tokenHash!: string;

  @Prop({ type: String })
  previousTokenHash?: string;

  @Prop({ type: Date })
  rotatedAt?: Date;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: String, maxlength: 300 })
  userAgent?: string;

  @Prop({ type: String, maxlength: 64 })
  ip?: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
