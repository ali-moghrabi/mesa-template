import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  RESERVATION_SOURCES,
  RESERVATION_STATUSES,
  type ReservationSource,
  type ReservationStatus,
} from 'lib/reservations';

export type ReservationDocument = HydratedDocument<Reservation>;

/**
 *   pending    the guest asked; the team hasn't answered yet
 *   confirmed  the team accepted it
 *   seated     they arrived and are at their table
 *   declined   the team couldn't take it (statusNote says why)
 *   cancelled  the guest (or the team) called it off
 *   completed  they came · no_show  they didn't
 */
@Schema({ _id: false })
export class ReservationEvent {
  @Prop({ type: String, required: true }) status!: string;
  @Prop({ type: Date, default: () => new Date() }) at!: Date;
  @Prop({ type: String }) by?: string;
  @Prop({ type: String }) note?: string;
}
const ReservationEventSchema = SchemaFactory.createForClass(ReservationEvent);

@Schema({ collection: 'reservations', timestamps: true })
export class Reservation {
  @Prop({ type: String, required: true, unique: true })
  number!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ type: String, enum: RESERVATION_SOURCES, default: 'online' })
  source!: ReservationSource;

  @Prop({
    type: String,
    enum: RESERVATION_STATUSES,
    default: 'pending',
    index: true,
  })
  status!: ReservationStatus;

  @Prop({ type: String, required: true }) date!: string;
  @Prop({ type: String, required: true }) time!: string;
  @Prop({ type: Date, required: true }) startsAt!: Date;
  @Prop({ type: String, required: true }) timezone!: string;

  @Prop({ type: Number, required: true, min: 1 }) partySize!: number;

  @Prop({ type: String, required: true }) name!: string;
  @Prop({ type: String, default: '' }) email!: string;
  @Prop({ type: String, default: '' }) phone!: string;

  @Prop({ type: String }) occasion?: string;
  @Prop({ type: String }) notes?: string;

  @Prop({ type: String }) statusNote?: string;
  @Prop({ type: String, default: '' }) staffNote!: string;
  @Prop({ type: String }) table?: string;

  @Prop({ type: String }) idempotencyKey?: string;

  @Prop({ type: [ReservationEventSchema], default: [] })
  history!: ReservationEvent[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation);
ReservationSchema.index({ userId: 1, startsAt: -1 });
ReservationSchema.index({ status: 1, startsAt: 1 });
ReservationSchema.index({ date: 1, time: 1 });
ReservationSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);
