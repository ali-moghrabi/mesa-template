import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type QueryFilter, type Model } from 'mongoose';
import type { CurrentActor } from 'decorators/current-user.decorator';
import {
  addDays,
  restaurantClock,
  shiftsLabel,
  shiftsOn,
} from 'lib/opening-hours';
import { zonedToDate } from 'lib/ordering';
import { escapeRegex } from 'lib/pagination';
import {
  ACTIVE_RESERVATION_STATUSES,
  STATUS_MOVES,
  type ReservationStatus,
} from 'lib/reservations';
import {
  Reservation,
  type ReservationDocument,
} from 'src/schemas/reservation.schema';
import { MailService } from 'src/features/mail/mail.service';
import {
  reservationUpdateEmail,
  type ReservationUpdateKind,
} from 'src/features/mail/templates';
import { OrderingConfig } from 'src/features/orders/ordering.config';
import type {
  CreateReservationAdminDto,
  ListReservationsQuery,
  ReservationStatusDto,
  UpdateReservationDto,
} from './dto/admin-reservation.dto';
import {
  ReservationsService,
  type ReservationRow,
  type ReservationView,
} from './reservations.service';

export type AdminReservation = ReservationView & {
  source: Reservation['source'];
  hasAccount: boolean;
  table?: string;
  staffNote: string;
  updatedAt: string;
  version: string;
  history: { status: string; at: string; by?: string; note?: string }[];
  moves: ReservationStatus[];
};

export type GuestStats = {
  total: number;
  visits: number;
  noShows: number;
  cancelled: number;
  lastVisit: string | null;
};
export type AdminReservationDetail = AdminReservation & { guest: GuestStats };

export type DaySummary = {
  bookings: number;
  covers: number;
  pending: number;
  confirmed: number;
  seated: number;
  completed: number;
  noShow: number;
  cancelled: number;
};

export type DayView = {
  date: string;
  today: string;
  timezone: string;
  service: { closed: boolean; label: string; special?: string };
  summary: DaySummary;
  items: AdminReservation[];
  week: { date: string; bookings: number; covers: number; pending: number }[];
  slotMinutes: number;
  maxCoversPerSlot: number | null;
};

export type RequestsView = { items: AdminReservation[]; count: number };
export type ReservationsPage = {
  items: AdminReservation[];
  total: number;
  page: number;
  pages: number;
};

const PAGE_SIZE = 20;
const COUNTED: ReservationStatus[] = [
  ...ACTIVE_RESERVATION_STATUSES,
  'completed',
  'no_show',
];
const versionOf = (r: { updatedAt?: Date }) =>
  new Date(r.updatedAt ?? 0).toISOString();
const changedMeanwhile = () =>
  new ConflictException(
    'Someone else updated this booking a moment ago. It has been refreshed, check it and try again.',
  );
const LABEL: Record<ReservationStatus, string> = {
  pending: 'waiting',
  confirmed: 'confirmed',
  seated: 'seated',
  completed: 'completed',
  no_show: 'no-show',
  declined: 'declined',
  cancelled: 'cancelled',
};

@Injectable()
export class ReservationsAdminService {
  private readonly logger = new Logger(ReservationsAdminService.name);

  constructor(
    @InjectModel(Reservation.name)
    private readonly reservationModel: Model<ReservationDocument>,
    private readonly reservations: ReservationsService,
    private readonly config: OrderingConfig,
    private readonly mail: MailService,
  ) {}

  async day(date?: string): Promise<DayView> {
    const rules = this.config.reservationRules();
    const hours = await this.reservations.hours();
    const timezone = hours?.timezone ?? rules.timezone;
    const clock = restaurantClock(timezone);
    const day = date ?? clock.date;

    const weekFrom = addDays(day, -3).date;
    const weekTo = addDays(day, 10).date;
    const [rows, week] = await Promise.all([
      this.reservationModel
        .find({ date: day })
        .sort({ time: 1, createdAt: 1 })
        .lean<ReservationRow[]>(),
      this.reservationModel.aggregate<{
        _id: string;
        bookings: number;
        covers: number;
        pending: number;
      }>([
        {
          $match: {
            date: { $gte: weekFrom, $lte: weekTo },
            status: { $in: COUNTED },
          },
        },
        {
          $group: {
            _id: '$date',
            bookings: { $sum: 1 },
            covers: { $sum: '$partySize' },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const items = rows.map((r) => this.view(r));
    const counted = items.filter((r) => COUNTED.includes(r.status));
    const count = (s: ReservationStatus) =>
      items.filter((r) => r.status === s).length;
    const summary: DaySummary = {
      bookings: counted.length,
      covers: counted.reduce((sum, r) => sum + r.partySize, 0),
      pending: count('pending'),
      confirmed: count('confirmed'),
      seated: count('seated'),
      completed: count('completed'),
      noShow: count('no_show'),
      cancelled: count('cancelled') + count('declined'),
    };

    const weekday = addDays(day, 0).day;
    const shifts = hours ? shiftsOn(hours, day, weekday) : null;
    const byDate = new Map(week.map((w) => [w._id, w]));
    return {
      date: day,
      today: clock.date,
      timezone,
      service: shifts
        ? {
            closed: shifts.shifts.length === 0,
            label: shiftsLabel(shifts.shifts),
            ...(shifts.special && { special: shifts.special.label }),
          }
        : { closed: false, label: 'Hours not set' },
      summary,
      items,
      week: Array.from({ length: 14 }, (_, i) => {
        const d = addDays(weekFrom, i).date;
        const w = byDate.get(d);
        return {
          date: d,
          bookings: w?.bookings ?? 0,
          covers: w?.covers ?? 0,
          pending: w?.pending ?? 0,
        };
      }),
      slotMinutes: rules.slotMinutes,
      maxCoversPerSlot: rules.maxCoversPerSlot,
    };
  }

  async requests(): Promise<RequestsView> {
    const filter = {
      status: 'pending' as const,
      startsAt: { $gte: new Date(Date.now() - 2 * 3_600_000) },
    };

    const rows = await this.reservationModel
      .find(filter)
      .sort({ startsAt: 1 })
      .limit(100)
      .lean<ReservationRow[]>();
    return { items: rows.map((r) => this.view(r)), count: rows.length };
  }

  async pendingCount(): Promise<{ count: number }> {
    const count = await this.reservationModel.countDocuments({
      status: 'pending',
      startsAt: { $gte: new Date() },
    });
    return { count };
  }

  async list(query: ListReservationsQuery): Promise<ReservationsPage> {
    const filter: QueryFilter<ReservationDocument> = {};
    const status = query.status;
    const upcoming = status === 'upcoming';
    if (status === 'upcoming') {
      filter.status = { $in: ACTIVE_RESERVATION_STATUSES };
      filter.startsAt = { $gte: new Date() };
    } else if (status) {
      filter.status = status;
    }

    const q = query.q?.trim();
    if (q) {
      const digits = q.replace(/[^\d]/g, '');
      const text = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { number: q.replace(/^#/, '') },
        { name: text },
        { email: text },
        ...(digits.length >= 3
          ? [{ phone: new RegExp(digits.split('').join('\\D*')) }]
          : []),
      ];
    }
    if (query.from || query.to)
      filter.date = {
        ...(query.from && { $gte: query.from }),
        ...(query.to && { $lte: query.to }),
      };

    const page = query.page ?? 1;
    const [rows, total] = await Promise.all([
      this.reservationModel
        .find(filter)
        .sort(upcoming ? { startsAt: 1 } : { startsAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<ReservationRow[]>(),
      this.reservationModel.countDocuments(filter),
    ]);
    return {
      items: rows.map((r) => this.view(r)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  async get(id: string): Promise<AdminReservationDetail> {
    const r = await this.find(id);
    return { ...this.view(r), guest: await this.guestStats(r) };
  }

  async changeStatus(
    actor: CurrentActor,
    id: string,
    dto: ReservationStatusDto,
  ): Promise<AdminReservationDetail> {
    const r = await this.find(id);
    if (versionOf(r) !== dto.version) throw changedMeanwhile();
    if (!this.moves(r).includes(dto.status)) {
      const passed =
        (r.status === 'declined' || r.status === 'cancelled') &&
        new Date(r.startsAt).getTime() < Date.now();
      throw new ConflictException(
        passed
          ? 'This booking time has passed, so it can no longer be restored.'
          : `A booking can't go from ${LABEL[r.status]} to ${LABEL[dto.status]}.`,
      );
    }

    const reason = dto.reason?.trim();
    const closing = dto.status === 'declined' || dto.status === 'cancelled';
    const restoring = r.status === 'declined' || r.status === 'cancelled';
    const updated = await this.reservationModel
      .findOneAndUpdate(
        { _id: r._id, updatedAt: r.updatedAt },
        {
          $set: {
            status: dto.status,
            ...(closing && reason && { statusNote: reason }),
          },
          ...(restoring && { $unset: { statusNote: 1 } }),
          $push: {
            history: {
              status: dto.status,
              at: new Date(),
              by: actor.name,
              ...(reason && { note: reason }),
            },
          },
        },
        { returnDocument: 'after' },
      )
      .lean<ReservationRow>();
    if (!updated) throw changedMeanwhile();

    const kind: ReservationUpdateKind | null =
      dto.status === 'confirmed' && (r.status === 'pending' || restoring)
        ? 'confirmed'
        : dto.status === 'declined'
          ? 'declined'
          : dto.status === 'cancelled'
            ? 'cancelled'
            : null;
    if (kind && dto.notify !== false) this.notify(updated, kind, reason);

    return { ...this.view(updated), guest: await this.guestStats(updated) };
  }

  async update(
    actor: CurrentActor,
    id: string,
    dto: UpdateReservationDto,
  ): Promise<AdminReservationDetail> {
    const r = await this.find(id);
    if (versionOf(r) !== dto.version) throw changedMeanwhile();

    const timezone = r.timezone || (await this.timezone());
    const next = {
      date: dto.date,
      time: dto.time,
      startsAt: zonedToDate(`${dto.date}T${dto.time}`, timezone),
      partySize: dto.partySize,
      name: dto.name,
      phone: dto.phone ?? '',
      email: (dto.email ?? '').toLowerCase(),
      occasion: dto.occasion || undefined,
      notes: dto.notes || undefined,
      table: dto.table || undefined,
    };

    const changes = [
      r.date !== next.date && `date ${r.date} → ${next.date}`,
      r.time !== next.time && `time ${r.time} → ${next.time}`,
      r.partySize !== next.partySize &&
        `guests ${r.partySize} → ${next.partySize}`,
      (r.table ?? '') !== (next.table ?? '') &&
        `table ${r.table || '–'} → ${next.table || '–'}`,
      r.name !== next.name && 'name',
      (r.phone ?? '') !== next.phone && 'phone',
      (r.email ?? '') !== next.email && 'email',
      (r.occasion ?? '') !== (next.occasion ?? '') && 'occasion',
      (r.notes ?? '') !== (next.notes ?? '') && "guest's note",
    ].filter(Boolean) as string[];
    if (changes.length === 0)
      return { ...this.view(r), guest: await this.guestStats(r) };

    const unset = (['occasion', 'notes', 'table'] as const).filter(
      (k) => next[k] === undefined,
    );
    const set = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== undefined),
    );
    const updated = await this.reservationModel
      .findOneAndUpdate(
        { _id: r._id, updatedAt: r.updatedAt },
        {
          $set: set,
          ...(unset.length > 0 && {
            $unset: Object.fromEntries(unset.map((k) => [k, 1])),
          }),
          $push: {
            history: {
              status: 'edited',
              at: new Date(),
              by: actor.name,
              note: changes.join(', '),
            },
          },
        },
        { returnDocument: 'after' },
      )
      .lean<ReservationRow>();
    if (!updated) throw changedMeanwhile();

    const guestFacing =
      r.date !== next.date ||
      r.time !== next.time ||
      r.partySize !== next.partySize;
    if (
      dto.notify &&
      guestFacing &&
      ACTIVE_RESERVATION_STATUSES.includes(updated.status)
    )
      this.notify(updated, 'changed');
    return { ...this.view(updated), guest: await this.guestStats(updated) };
  }

  async create(
    actor: CurrentActor,
    dto: CreateReservationAdminDto,
  ): Promise<AdminReservationDetail> {
    const timezone = await this.timezone();
    const now = new Date();
    const status: ReservationStatus = dto.seatNow ? 'seated' : 'confirmed';
    const how = dto.source === 'walk_in' ? 'Walk-in' : 'Booked by phone';
    const doc = await this.reservationModel.create({
      number: await this.reservations.nextNumber(),
      source: dto.source,
      status,
      date: dto.date,
      time: dto.time,
      startsAt: zonedToDate(`${dto.date}T${dto.time}`, timezone),
      timezone,
      partySize: dto.partySize,
      name: dto.name,
      email: (dto.email ?? '').toLowerCase(),
      phone: dto.phone ?? '',
      ...(dto.occasion && { occasion: dto.occasion }),
      ...(dto.notes && { notes: dto.notes }),
      ...(dto.table && { table: dto.table }),
      history: [
        { status: 'confirmed', at: now, by: actor.name, note: how },
        ...(dto.seatNow ? [{ status: 'seated', at: now, by: actor.name }] : []),
      ],
    });
    const created = doc.toObject() as ReservationRow;
    if (dto.notify && !dto.seatNow) this.notify(created, 'confirmed');
    return { ...this.view(created), guest: await this.guestStats(created) };
  }

  async setNote(id: string, note: string): Promise<AdminReservationDetail> {
    const r = await this.find(id);
    const updated = await this.reservationModel
      .findByIdAndUpdate(
        r._id,
        { $set: { staffNote: note } },
        { returnDocument: 'after' },
      )
      .lean<ReservationRow>();
    if (!updated) throw new NotFoundException('Booking not found');
    return { ...this.view(updated), guest: await this.guestStats(updated) };
  }

  private async find(id: string): Promise<ReservationRow> {
    if (!isValidObjectId(id)) throw new NotFoundException('Booking not found');
    const row = await this.reservationModel.findById(id).lean<ReservationRow>();
    if (!row) throw new NotFoundException('Booking not found');
    return row;
  }

  private async timezone(): Promise<string> {
    const hours = await this.reservations.hours();
    return hours?.timezone ?? this.config.reservationRules().timezone;
  }

  private moves(r: ReservationRow): ReservationStatus[] {
    const passed = new Date(r.startsAt).getTime() < Date.now();
    return STATUS_MOVES[r.status].filter(
      (to) =>
        !(
          (r.status === 'declined' || r.status === 'cancelled') &&
          to === 'confirmed' &&
          passed
        ),
    );
  }

  private async guestStats(r: ReservationRow): Promise<GuestStats> {
    const who = r.userId
      ? { userId: r.userId }
      : r.email
        ? { email: r.email }
        : r.phone
          ? { phone: r.phone }
          : null;
    if (!who)
      return { total: 1, visits: 0, noShows: 0, cancelled: 0, lastVisit: null };
    const [groups, last] = await Promise.all([
      this.reservationModel.aggregate<{ _id: ReservationStatus; n: number }>([
        { $match: who },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]),
      this.reservationModel
        .findOne({ ...who, status: 'completed' }, { date: 1 })
        .sort({ startsAt: -1 })
        .lean<{ date: string }>(),
    ]);
    const n = (s: ReservationStatus) => groups.find((g) => g._id === s)?.n ?? 0;
    return {
      total: groups.reduce((sum, g) => sum + g.n, 0),
      visits: n('completed') + n('seated'),
      noShows: n('no_show'),
      cancelled: n('cancelled'),
      lastVisit: last?.date ?? null,
    };
  }

  private notify(
    r: ReservationRow,
    kind: ReservationUpdateKind,
    reason?: string,
  ) {
    if (!r.email) return;
    const brand = this.mail.brand();
    const view = this.reservations.view(r);
    this.mail
      .send(
        r.email,
        reservationUpdateEmail(brand, {
          reservation: view,
          kind,
          reason,
          link: `${brand.webUrl}/account/reservations`,
          hasAccount: Boolean(r.userId),
        }),
      )
      .catch((error: unknown) =>
        this.logger.error(
          `Booking email (${kind}) for #${r.number} failed: ${(error as Error).message}`,
        ),
      );
  }

  view(r: ReservationRow): AdminReservation {
    return {
      ...this.reservations.view(r),
      source: r.source ?? 'online',
      hasAccount: Boolean(r.userId),
      ...(r.table && { table: r.table }),
      staffNote: r.staffNote ?? '',
      updatedAt: versionOf(r),
      version: versionOf(r),
      history: (r.history ?? []).map((h) => ({
        status: h.status,
        at: new Date(h.at).toISOString(),
        ...(h.by && { by: h.by }),
        ...(h.note && { note: h.note }),
      })),
      moves: this.moves(r),
    };
  }
}
