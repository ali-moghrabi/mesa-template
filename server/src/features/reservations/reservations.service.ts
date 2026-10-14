import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types, type Model } from 'mongoose';
import { formError, isDuplicateKey } from 'lib/form-errors';
import type { OpeningHours } from 'lib/opening-hours';
import { zonedToDate } from 'lib/ordering';
import {
  ACTIVE_RESERVATION_STATUSES,
  CANCELLABLE_STATUSES,
  MAX_UPCOMING_PER_GUEST,
  availability,
  canBook,
  type Availability,
  type ReservationRules,
  type ReservationStatus,
} from 'lib/reservations';
import { Counter } from 'src/schemas/order.schema';
import {
  Reservation,
  type ReservationDocument,
} from 'src/schemas/reservation.schema';
import { User, type UserDocument } from 'src/schemas/user.schema';
import { MailService } from 'src/features/mail/mail.service';
import { reservationRequestEmail } from 'src/features/mail/templates';
import { OrderingConfig } from 'src/features/orders/ordering.config';
import { SettingsService } from 'src/features/settings/settings.service';
import type {
  CancelReservationDto,
  CreateReservationDto,
} from './dto/reservation.dto';

export type ReservationView = {
  id: string;
  number: string;
  status: ReservationStatus;
  date: string;
  time: string;
  startsAt: string;
  timezone: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  occasion?: string;
  notes?: string;
  statusNote?: string;
  createdAt: string;
  canCancel: boolean;
};

export type MyReservations = {
  upcoming: ReservationView[];
  past: ReservationView[];
};

export type ReservationRow = Reservation & { _id: Types.ObjectId };

const FIRST_NUMBER = 1000;
const PAST_LIMIT = 30;

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @InjectModel(Reservation.name)
    private readonly reservationModel: Model<ReservationDocument>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: OrderingConfig,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
  ) {}

  async availability(): Promise<Availability> {
    const rules = this.rulesOrThrow();
    return this.compute(rules);
  }

  async create(
    userId: string,
    dto: CreateReservationDto,
  ): Promise<ReservationView> {
    const rules = this.rulesOrThrow();
    const owner = new Types.ObjectId(userId);

    if (dto.idempotencyKey) {
      const again = await this.reservationModel
        .findOne({ userId: owner, idempotencyKey: dto.idempotencyKey })
        .lean<ReservationRow>();
      if (again) return this.view(again);
    }

    if (
      dto.partySize < rules.minPartySize ||
      dto.partySize > rules.maxPartySize
    )
      throw formError({
        partySize: `We take bookings for ${rules.minPartySize} to ${rules.maxPartySize} guests online`,
      });
    if (dto.occasion && !rules.occasions.includes(dto.occasion))
      throw formError({ occasion: 'Choose an occasion from the list' });
    if (dto.notes && !rules.allowSpecialRequests)
      throw formError({ notes: "We can't take special requests online" });

    const user = await this.userModel
      .findById(owner, { firstName: 1, lastName: 1, email: 1, phone: 1 })
      .lean<{
        firstName?: string;
        lastName?: string;
        email: string;
        phone?: string;
      }>();
    if (!user) throw new NotFoundException('Your account was not found');
    const phone = dto.phone || user.phone?.trim() || '';
    if (rules.requirePhone && !phone)
      throw formError({
        phone: 'Add a phone number so we can reach you about your table',
      });

    const open = await this.compute(rules);
    const slot = canBook(open, dto.date, dto.time, dto.partySize);
    if (slot === 'gone')
      throw formError(
        { time: 'This time is no longer available. Pick another one.' },
        'This time is no longer available',
      );
    if (slot === 'full')
      throw formError(
        {
          time: `Not enough seats left at ${dto.time} for ${dto.partySize}. Try another time.`,
        },
        'Not enough seats at that time',
      );

    const now = new Date();
    const [upcoming, sameDay] = await Promise.all([
      this.reservationModel.countDocuments({
        userId: owner,
        status: { $in: ACTIVE_RESERVATION_STATUSES },
        startsAt: { $gte: now },
      }),
      this.reservationModel.exists({
        userId: owner,
        status: { $in: ACTIVE_RESERVATION_STATUSES },
        date: dto.date,
      }),
    ]);
    if (sameDay)
      throw new ConflictException(
        "You already have a table booked that day. You'll find it in My reservations.",
      );
    if (upcoming >= MAX_UPCOMING_PER_GUEST)
      throw new ConflictException(
        `You have ${upcoming} upcoming bookings. Once one has passed or is cancelled, you can book another.`,
      );

    let created: ReservationRow;
    try {
      const doc = await this.reservationModel.create({
        number: await this.nextNumber(),
        userId: owner,
        status: 'pending',
        date: dto.date,
        time: dto.time,
        startsAt: zonedToDate(`${dto.date}T${dto.time}`, open.timezone),
        timezone: open.timezone,
        partySize: dto.partySize,
        name:
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
          user.email,
        email: user.email,
        phone,
        ...(dto.occasion && { occasion: dto.occasion }),
        ...(dto.notes && { notes: dto.notes }),
        ...(dto.idempotencyKey && { idempotencyKey: dto.idempotencyKey }),
        history: [{ status: 'pending', at: now }],
      });
      created = doc.toObject();
    } catch (error) {
      if (isDuplicateKey(error) && dto.idempotencyKey) {
        const again = await this.reservationModel
          .findOne({ userId: owner, idempotencyKey: dto.idempotencyKey })
          .lean<ReservationRow>();
        if (again) return this.view(again);
      }
      throw error;
    }

    const view = this.view(created);
    const brand = this.mail.brand();
    this.mail
      .send(
        view.email,
        reservationRequestEmail(brand, {
          reservation: view,
          link: `${brand.webUrl}/account/reservations`,
          message: rules.confirmationMessage,
        }),
      )
      .catch((error: unknown) =>
        this.logger.error(
          `Booking email for #${view.number} failed: ${(error as Error).message}`,
        ),
      );
    return view;
  }

  async mine(userId: string): Promise<MyReservations> {
    const owner = new Types.ObjectId(userId);
    const now = new Date();
    const [upcoming, past] = await Promise.all([
      this.reservationModel
        .find({
          userId: owner,
          status: { $in: ACTIVE_RESERVATION_STATUSES },
          startsAt: { $gte: now },
        })
        .sort({ startsAt: 1 })
        .lean<ReservationRow[]>(),
      this.reservationModel
        .find({
          userId: owner,
          $or: [
            { status: { $nin: ACTIVE_RESERVATION_STATUSES } },
            { startsAt: { $lt: now } },
          ],
        })
        .sort({ startsAt: -1 })
        .limit(PAST_LIMIT)
        .lean<ReservationRow[]>(),
    ]);
    return {
      upcoming: upcoming.map((r) => this.view(r)),
      past: past.map((r) => this.view(r)),
    };
  }

  async get(userId: string, id: string): Promise<ReservationView> {
    return this.view(await this.own(userId, id));
  }

  async cancel(
    userId: string,
    id: string,
    dto: CancelReservationDto,
  ): Promise<ReservationView> {
    const current = await this.own(userId, id);
    if (!this.cancellable(current)) {
      throw new ConflictException(
        current.status === 'cancelled'
          ? 'This booking is already cancelled.'
          : "This booking can't be cancelled online anymore. Please call us.",
      );
    }
    const reason = dto.reason?.trim();
    const updated = await this.reservationModel
      .findOneAndUpdate(
        { _id: current._id, status: { $in: CANCELLABLE_STATUSES } },
        {
          $set: { status: 'cancelled', ...(reason && { statusNote: reason }) },
          $push: {
            history: {
              status: 'cancelled',
              at: new Date(),
              note: reason || 'Cancelled by the guest',
            },
          },
        },
        { returnDocument: 'after' },
      )
      .lean<ReservationRow>();
    if (!updated)
      throw new ConflictException(
        'This booking changed in the meantime. Refresh and try again.',
      );
    return this.view(updated);
  }

  private rulesOrThrow(): ReservationRules {
    const rules = this.config.reservationRules();
    if (!rules.enabled)
      throw new ForbiddenException(
        'Online booking is off right now. Please call us to book a table.',
      );
    return rules;
  }

  async compute(rules: ReservationRules): Promise<Availability> {
    const hours = await this.hours();
    const timezone = hours?.timezone ?? rules.timezone;
    let booked: { startsAt: Date; partySize: number }[] = [];
    if (rules.maxCoversPerSlot) {
      const from = new Date(Date.now() - rules.durationMinutes * 60_000);
      const to = new Date(Date.now() + (rules.advanceDays + 2) * 86_400_000);
      booked = await this.reservationModel
        .find(
          {
            status: { $in: ACTIVE_RESERVATION_STATUSES },
            startsAt: { $gte: from, $lte: to },
          },
          { startsAt: 1, partySize: 1 },
        )
        .lean<{ startsAt: Date; partySize: number }[]>();
    }
    return availability(hours, rules, booked, (local) =>
      zonedToDate(local, timezone),
    );
  }

  async hours(): Promise<OpeningHours | null> {
    const saved = await this.settings.publicOpeningHours();
    return saved.hours ?? this.config.settings().configHours;
  }

  private async own(userId: string, id: string): Promise<ReservationRow> {
    if (!isValidObjectId(id)) throw new NotFoundException('Booking not found');
    const row = await this.reservationModel
      .findOne({ _id: id, userId: new Types.ObjectId(userId) })
      .lean<ReservationRow>();
    if (!row) throw new NotFoundException('Booking not found');
    return row;
  }

  private cancellable(r: Pick<Reservation, 'status' | 'startsAt'>): boolean {
    return (
      CANCELLABLE_STATUSES.includes(r.status) &&
      new Date(r.startsAt).getTime() > Date.now()
    );
  }

  async nextNumber(): Promise<string> {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { _id: 'reservations' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      )
      .lean<Counter>();
    return String(FIRST_NUMBER + (counter?.seq ?? 1));
  }

  view(r: ReservationRow): ReservationView {
    return {
      id: r._id.toString(),
      number: r.number,
      status: r.status,
      date: r.date,
      time: r.time,
      startsAt: new Date(r.startsAt).toISOString(),
      timezone: r.timezone,
      partySize: r.partySize,
      name: r.name,
      email: r.email,
      phone: r.phone ?? '',
      ...(r.occasion && { occasion: r.occasion }),
      ...(r.notes && { notes: r.notes }),
      ...(r.statusNote && { statusNote: r.statusNote }),
      createdAt: new Date(r.createdAt).toISOString(),
      canCancel: this.cancellable(r),
    };
  }
}
