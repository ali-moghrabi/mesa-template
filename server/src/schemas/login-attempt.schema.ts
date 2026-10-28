import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LoginAttemptDocument = HydratedDocument<LoginAttempt>;

@Schema({ collection: 'login_attempts', timestamps: false })
export class LoginAttempt {
  @Prop({ type: String, required: true, unique: true })
  key!: string;

  @Prop({ type: Number, default: 0 })
  failures!: number;

  @Prop({ type: Date, required: true })
  windowStart!: Date;

  @Prop({ type: Date, default: null })
  lockedUntil!: Date | null;

  @Prop({ type: Number, default: 0 })
  locks!: number;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;
}

export const LoginAttemptSchema = SchemaFactory.createForClass(LoginAttempt);
LoginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
