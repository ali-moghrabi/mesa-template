import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type MfaChallengeDocument = HydratedDocument<MfaChallenge>;

@Schema({
  collection: 'mfa_challenges',
  timestamps: { createdAt: true, updatedAt: false },
})
export class MfaChallenge {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  tokenHash!: string;

  @Prop({ type: String, enum: ['verify', 'setup'], required: true })
  purpose!: 'verify' | 'setup';

  @Prop({ type: String })
  pendingSecret?: string;

  @Prop({ type: Number, default: 0 })
  attempts!: number;

  @Prop({ type: Number, default: 0 })
  tokenVersion!: number;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;
}

export const MfaChallengeSchema = SchemaFactory.createForClass(MfaChallenge);
MfaChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
