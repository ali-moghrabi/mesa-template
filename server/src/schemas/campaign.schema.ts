import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CampaignDocument = HydratedDocument<Campaign>;

export const CAMPAIGN_STATUSES = [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'paused',
  'cancelled',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_KINDS = ['manual', 'sale'] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

@Schema({ _id: false })
export class CampaignButton {
  @Prop({ type: String, required: true, maxlength: 40 }) label!: string;
  @Prop({ type: String, required: true, maxlength: 500 }) url!: string;
}
const CampaignButtonSchema = SchemaFactory.createForClass(CampaignButton);

@Schema({ _id: false })
export class CampaignStats {
  @Prop({ type: Number, default: 0 }) recipients!: number;
  @Prop({ type: Number, default: 0 }) sent!: number;
  @Prop({ type: Number, default: 0 }) failed!: number;
}
const CampaignStatsSchema = SchemaFactory.createForClass(CampaignStats);

@Schema({ collection: 'newsletter_campaigns', timestamps: true })
export class Campaign {
  @Prop({ type: String, enum: CAMPAIGN_KINDS, default: 'manual' })
  kind!: CampaignKind;
  @Prop({
    type: String,
    enum: CAMPAIGN_STATUSES,
    default: 'draft',
    index: true,
  })
  status!: CampaignStatus;

  @Prop({ type: String, default: '', maxlength: 120 }) subject!: string;
  @Prop({ type: String, default: '', maxlength: 160 }) preheader!: string;
  @Prop({ type: String, default: '', maxlength: 120 }) heading!: string;
  @Prop({ type: String, default: '', maxlength: 10_000 }) body!: string;
  @Prop({ type: CampaignButtonSchema }) button?: CampaignButton;
  @Prop({ type: [Types.ObjectId], default: [] }) dishIds!: Types.ObjectId[];

  @Prop({ type: Date, index: true }) scheduledAt?: Date;
  @Prop({ type: Date }) startedAt?: Date;
  @Prop({ type: Date }) sentAt?: Date;
  @Prop({ type: CampaignStatsSchema, default: () => ({}) })
  stats!: CampaignStats;
  @Prop({ type: Types.ObjectId }) cursor?: Types.ObjectId;
  @Prop({ type: Date }) lockedUntil?: Date;
  @Prop({ type: String }) lastError?: string;
  @Prop({ type: Number, default: 0 }) failStreak!: number;

  @Prop({ type: [Types.ObjectId], default: [] })
  promotionIds!: Types.ObjectId[];
  @Prop({ type: Boolean, default: false }) needsReview!: boolean;

  @Prop({ type: String }) createdBy?: string;
  @Prop({ type: String }) sentBy?: string;

  createdAt!: Date;
  updatedAt!: Date;
}
export const CampaignSchema = SchemaFactory.createForClass(Campaign);
CampaignSchema.index({ status: 1, updatedAt: -1 });

export type NewsletterSettingsDocument = HydratedDocument<NewsletterSettings>;

@Schema({ _id: false })
export class WelcomeAutomation {
  @Prop({ type: Boolean, default: true }) enabled!: boolean;
  @Prop({ type: String, default: '', maxlength: 1000 }) message!: string;
}
const WelcomeAutomationSchema = SchemaFactory.createForClass(WelcomeAutomation);

@Schema({ _id: false })
export class SaleAutomation {
  @Prop({ type: Boolean, default: false }) enabled!: boolean;
  @Prop({ type: String, enum: ['auto', 'review'], default: 'review' }) mode!:
    'auto' | 'review';
  @Prop({ type: Number, default: 10, min: 1, max: 90 }) minPercent!: number;
  @Prop({ type: Number, default: 3, min: 0, max: 30 }) cooldownDays!: number;
  @Prop({ type: String, default: '', maxlength: 1000 }) intro!: string;
  @Prop({ type: Date }) enabledAt?: Date;
  @Prop({ type: Date }) lastSentAt?: Date;
}
const SaleAutomationSchema = SchemaFactory.createForClass(SaleAutomation);

@Schema({ collection: 'newsletter_settings' })
export class NewsletterSettings {
  @Prop({ type: String, required: true }) _id!: string;
  @Prop({ type: WelcomeAutomationSchema, default: () => ({}) })
  welcome!: WelcomeAutomation;
  @Prop({ type: SaleAutomationSchema, default: () => ({}) })
  sale!: SaleAutomation;
}
export const NewsletterSettingsSchema =
  SchemaFactory.createForClass(NewsletterSettings);

export type SaleAnnouncementDocument = HydratedDocument<SaleAnnouncement>;

@Schema({ collection: 'newsletter_sale_announcements', timestamps: true })
export class SaleAnnouncement {
  @Prop({ type: Types.ObjectId, required: true }) promotionId!: Types.ObjectId;
  @Prop({ type: String, required: true }) signature!: string;
  @Prop({ type: String, enum: ['announced', 'skipped'], required: true })
  outcome!: 'announced' | 'skipped';
  @Prop({ type: Types.ObjectId }) campaignId?: Types.ObjectId;
  createdAt!: Date;
}
export const SaleAnnouncementSchema =
  SchemaFactory.createForClass(SaleAnnouncement);
SaleAnnouncementSchema.index(
  { promotionId: 1, signature: 1 },
  { unique: true },
);
