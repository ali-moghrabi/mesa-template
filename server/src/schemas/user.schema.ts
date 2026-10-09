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

  @Prop({ type: String, required: true, select: false })
  password!: string;

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
}

export const UserSchema = SchemaFactory.createForClass(User);
