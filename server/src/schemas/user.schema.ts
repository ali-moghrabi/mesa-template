import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ROLES, type Role } from 'lib/constants/roles';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ type: String, required: true })
  firstName!: string;

  @Prop({ type: String, required: true })
  lastName!: string;

  @Prop({ type: String, required: true, unique: true })
  username!: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  })
  email!: string;

  @Prop({ type: String, select: false })
  password?: string;

  @Prop({ type: String, unique: true, sparse: true, select: false })
  googleId?: string;

  @Prop({ type: String, trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: String, enum: ROLES, default: 'customer', index: true })
  role!: Role;

  @Prop({ type: Date })
  emailVerifiedAt?: Date;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ type: Number, default: 0, select: false })
  tokenVersion!: number;

  @Prop({ default: false })
  isEmailVerified!: boolean;

  @Prop({ type: Boolean, default: false })
  mfaEnabled!: boolean;

  @Prop({ type: Date })
  mfaEnabledAt?: Date;

  @Prop({ type: String, select: false })
  mfaSecret?: string;

  @Prop({ type: String, select: false })
  mfaPendingSecret?: string;

  @Prop({ type: Date, select: false })
  mfaPendingAt?: Date;

  @Prop({ type: Number, select: false })
  mfaLastStep?: number;

  @Prop({ type: [String], select: false, default: undefined })
  mfaRecoveryCodes?: string[];

  @Prop({ type: Number, select: false })
  mfaFailures?: number;

  @Prop({ type: Date, select: false })
  mfaLockedUntil?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
