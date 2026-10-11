import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import type { OpeningHours } from 'lib/opening-hours';

export type SettingsDocument = HydratedDocument<Settings>;

export const SETTINGS_ID = 'restaurant';

@Schema({ collection: 'settings', timestamps: true })
export class Settings {
  @Prop({ type: String })
  _id!: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  openingHours?: OpeningHours;

  @Prop({ type: Date })
  openingHoursUpdatedAt?: Date;

  @Prop(raw({ id: { type: String }, name: { type: String } }))
  openingHoursUpdatedBy?: { id: string; name: string };
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
