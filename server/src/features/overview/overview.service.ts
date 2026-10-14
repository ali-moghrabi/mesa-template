import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, PipelineStage, Types } from 'mongoose';
import type { CurrentActor } from 'decorators/current-user.decorator';
import { canAccessAdmin, hasPermission } from 'lib/constants/roles';
import { mediaUrl } from 'lib/media-url';
import { fromMinor } from 'lib/money';
import {
  addDays,
  getOpenStatus,
  restaurantClock,
  shiftsLabel,
  shiftsOn,
} from 'lib/opening-hours';
import { zonedToDate, type OrderType } from 'lib/ordering';
import type { ReservationStatus } from 'lib/reservations';
import { MenuItem, type MenuItemDocument } from 'src/schemas/item.schema';
import { Message, type MessageDocument } from 'src/schemas/message.schema';
import {
  Order,
  type OrderDocument,
  type OrderStatus,
} from 'src/schemas/order.schema';
import {
  Reservation,
  type ReservationDocument,
} from 'src/schemas/reservation.schema';
import { OrderingConfig } from 'src/features/orders/ordering.config';
import { ACTIVE_STATUSES } from 'src/features/orders/orders.service';
import { ReservationsService } from 'src/features/reservations/reservations.service';

export const OVERVIEW_RANGES = [7, 30, 90] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];

export type Compare = { value: number; previous: number };

export type LiveOrders = {
  enabled: boolean;
  new: number;
  cooking: number;
  ready: number;
  oldestWaitingAt: string | null;
  today: {
    orders: Compare;
    cancelled: number;
    avgPrepMinutes: number | null;
  };
  hourly: { hour: number; today: number; lastWeek: number }[];
  recent: {
    id: string;
    number: string;
    status: OrderStatus;
    type: OrderType;
    customer: string;
    itemCount: number;
    total: number;
    placedAt: string;
  }[];
};

export type ReservationsToday = {
  enabled: boolean;
  summary: {
    bookings: number;
    covers: number;
    pending: number;
    confirmed: number;
    seated: number;
    completed: number;
    noShow: number;
  };
  requests: number;
  next: {
    id: string;
    number: string;
    time: string;
    name: string;
    partySize: number;
    status: ReservationStatus;
    occasion?: string;
    table?: string;
  }[];
  week: { date: string; bookings: number; covers: number; pending: number }[];
};

export type MenuWatch = {
  soldOut: { id: string; name: string; image?: string }[];
  soldOutCount: number;
  dishes: number;
};

export type MessagesWatch = {
  enabled: boolean;
  unread: number;
  latest: {
    id: string;
    name: string;
    subject: string;
    preview: string;
    createdAt: string;
  }[];
};

export type ActivityItem =
  | {
      key: string;
      kind: 'order';
      id: string;
      number: string;
      status: string;
      type: OrderType;
      name: string;
      by?: string;
      at: string;
    }
  | {
      key: string;
      kind: 'reservation';
      id: string;
      number: string;
      status: string;
      name: string;
      partySize: number;
      date: string;
      time: string;
      by?: string;
      at: string;
    }
  | {
      key: string;
      kind: 'message';
      id: string;
      name: string;
      subject: string;
      at: string;
    };

export type Sales = {
  range: OverviewRange;
  from: string;
  revenue: Compare;
  orders: Compare;
  average: Compare;
  covers: Compare;
  avgPrepMinutes: Compare;
  todayRevenue: Compare;
  daily: {
    date: string;
    revenue: number;
    orders: number;
    previousRevenue: number;
    previousOrders: number;
  }[];
  topDishes: { name: string; quantity: number; revenue: number }[];
  channels: { type: OrderType; orders: number; revenue: number }[];
  payments: { method: 'card' | 'cash'; orders: number; revenue: number }[];
  heatmap: { day: number; hour: number; orders: number }[];
  cancelled: Compare;
};

export type Overview = {
  serverTime: string;
  today: string;
  timezone: string;
  currency: string;
  restaurant: {
    open: boolean;
    label: string;
    closingSoon: boolean;
    special?: string;
    todayHours: string;
  };
  orders?: LiveOrders;
  reservations?: ReservationsToday;
  menu?: MenuWatch;
  messages?: MessagesWatch;
  activity: ActivityItem[];
  sales?: Sales;
};

const DAY_MS = 86_400_000;
const ACTIVITY_SIZE = 14;
const REAL_ORDER = {
  placedAt: { $exists: true },
  status: { $ne: 'awaiting_payment' },
} as const;
const NET = {
  $cond: [
    { $eq: ['$status', 'cancelled'] },
    0,
    { $subtract: ['$amounts.total', { $ifNull: ['$payment.refunded', 0] }] },
  ],
};
const PREP_MINUTES = {
  $let: {
    vars: {
      ready: {
        $min: {
          $map: {
            input: {
              $filter: {
                input: '$history',
                cond: { $in: ['$$this.status', ['ready', 'out_for_delivery']] },
              },
            },
            in: '$$this.at',
          },
        },
      },
    },
    in: {
      $cond: [
        { $gt: ['$$ready', null] },
        { $divide: [{ $subtract: ['$$ready', '$placedAt'] }, 60_000] },
        null,
      ],
    },
  },
};

const money = (minor: number | undefined) =>
  round(fromMinor(minor ?? 0) ?? 0, 2);
const round = (value: number, digits = 0) =>
  Math.round(value * 10 ** digits) / 10 ** digits;
const roundOrNull = (value: number | null | undefined) =>
  value == null ? null : round(value);

type Row = { _id: Types.ObjectId };

@Injectable()
export class OverviewService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Reservation.name)
    private readonly reservationModel: Model<ReservationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(MenuItem.name)
    private readonly itemModel: Model<MenuItemDocument>,
    private readonly config: OrderingConfig,
    private readonly reservations: ReservationsService,
  ) {}

  async overview(
    me: CurrentActor,
    range: OverviewRange = 7,
  ): Promise<Overview> {
    if (!canAccessAdmin(me.role)) throw new ForbiddenException();
    const can = {
      orders: hasPermission(me.role, 'orders:manage'),
      reservations: hasPermission(me.role, 'reservations:view'),
      menu: hasPermission(me.role, 'menu:availability'),
      messages: hasPermission(me.role, 'content:manage'),
      analytics: hasPermission(me.role, 'analytics:view'),
    };

    const settings = this.config.settings();
    const hours = await this.reservations.hours();
    const timezone = hours?.timezone ?? settings.rules.timezone;
    const now = new Date();
    const clock = restaurantClock(timezone, now);
    const startOfToday = zonedToDate(`${clock.date}T00:00`, timezone);
    const ctx: Ctx = { now, today: clock.date, timezone, startOfToday };

    const open = hours
      ? getOpenStatus(hours, now)
      : {
          open: false,
          label: 'Opening hours not set',
          closingSoon: false,
          special: undefined,
        };
    const todayShifts = hours
      ? shiftsOn(hours, clock.date, clock.day).shifts
      : [];

    const [orders, reservations, menu, messages, activity, sales] =
      await Promise.all([
        can.orders ? this.liveOrders(ctx, settings.rules.enabled) : undefined,
        can.reservations
          ? this.reservationsToday(ctx, settings.reservations.enabled)
          : undefined,
        can.menu ? this.menuWatch() : undefined,
        can.messages ? this.messagesWatch(settings.contact.enabled) : undefined,
        this.activity(ctx, can),
        can.analytics ? this.sales(ctx, range, can.reservations) : undefined,
      ]);

    return {
      serverTime: now.toISOString(),
      today: clock.date,
      timezone,
      currency: settings.rules.currency,
      restaurant: {
        open: open.open,
        label: open.label,
        closingSoon: open.closingSoon,
        special: open.special,
        todayHours: todayShifts.length
          ? shiftsLabel(todayShifts)
          : 'Closed today',
      },
      orders,
      reservations,
      menu,
      messages,
      activity,
      sales,
    };
  }

  private async liveOrders(ctx: Ctx, enabled: boolean): Promise<LiveOrders> {
    const lastWeekStart = new Date(ctx.startOfToday.getTime() - 7 * DAY_MS);
    const lastWeekNow = new Date(ctx.now.getTime() - 7 * DAY_MS);
    const lastWeekEnd = new Date(lastWeekStart.getTime() + DAY_MS);

    const [active, today, hourly, recent] = await Promise.all([
      this.orderModel.aggregate<{
        _id: OrderStatus;
        count: number;
        oldest: Date;
      }>([
        {
          $match: {
            status: { $in: ACTIVE_STATUSES },
            placedAt: { $exists: true },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            oldest: { $min: '$placedAt' },
          },
        },
      ]),
      this.orderModel.aggregate<{
        _id: 'today' | 'lastWeek';
        orders: number;
        cancelled: number;
        prep: number | null;
      }>([
        {
          $match: {
            ...REAL_ORDER,
            $or: [
              { placedAt: { $gte: ctx.startOfToday, $lte: ctx.now } },
              { placedAt: { $gte: lastWeekStart, $lte: lastWeekNow } },
            ],
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $gte: ['$placedAt', ctx.startOfToday] },
                'today',
                'lastWeek',
              ],
            },
            orders: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, 1] },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            prep: { $avg: PREP_MINUTES },
          },
        },
      ]),
      this.orderModel.aggregate<{
        _id: { when: 'today' | 'lastWeek'; hour: number };
        orders: number;
      }>([
        {
          $match: {
            ...REAL_ORDER,
            status: { $nin: ['awaiting_payment', 'cancelled'] },
            $or: [
              { placedAt: { $gte: ctx.startOfToday } },
              { placedAt: { $gte: lastWeekStart, $lt: lastWeekEnd } },
            ],
          },
        },
        {
          $group: {
            _id: {
              when: {
                $cond: [
                  { $gte: ['$placedAt', ctx.startOfToday] },
                  'today',
                  'lastWeek',
                ],
              },
              hour: { $hour: { date: '$placedAt', timezone: ctx.timezone } },
            },
            orders: { $sum: 1 },
          },
        },
      ]),
      this.orderModel
        .find(REAL_ORDER, {
          number: 1,
          status: 1,
          type: 1,
          'customer.name': 1,
          lines: 1,
          'amounts.total': 1,
          placedAt: 1,
        })
        .sort({ placedAt: -1 })
        .limit(6)
        .lean<
          (Row &
            Pick<
              Order,
              'number' | 'status' | 'type' | 'lines' | 'amounts' | 'placedAt'
            > & { customer: { name: string } })[]
        >(),
    ]);

    const count = (...statuses: OrderStatus[]) =>
      active
        .filter((a) => statuses.includes(a._id))
        .reduce((sum, a) => sum + a.count, 0);
    const oldest = active.find((a) => a._id === 'placed')?.oldest;
    const t = today.find((x) => x._id === 'today');
    const w = today.find((x) => x._id === 'lastWeek');

    return {
      enabled,
      new: count('placed'),
      cooking: count('accepted', 'preparing'),
      ready: count('ready', 'out_for_delivery'),
      oldestWaitingAt: oldest ? new Date(oldest).toISOString() : null,
      today: {
        orders: { value: t?.orders ?? 0, previous: w?.orders ?? 0 },
        cancelled: t?.cancelled ?? 0,
        avgPrepMinutes: roundOrNull(t?.prep),
      },
      hourly: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        today:
          hourly.find((h) => h._id.when === 'today' && h._id.hour === hour)
            ?.orders ?? 0,
        lastWeek:
          hourly.find((h) => h._id.when === 'lastWeek' && h._id.hour === hour)
            ?.orders ?? 0,
      })),
      recent: recent.map((o) => ({
        id: o._id.toString(),
        number: o.number,
        status: o.status,
        type: o.type,
        customer: o.customer?.name ?? '',
        itemCount: o.lines.reduce((sum, l) => sum + l.quantity, 0),
        total: money(o.amounts.total),
        placedAt: new Date(o.placedAt ?? 0).toISOString(),
      })),
    };
  }

  private async reservationsToday(
    ctx: Ctx,
    enabled: boolean,
  ): Promise<ReservationsToday> {
    const weekEnd = addDays(ctx.today, 6).date;
    const soon = new Date(ctx.now.getTime() - 30 * 60_000);
    const [byStatus, requests, next, week] = await Promise.all([
      this.reservationModel.aggregate<{
        _id: ReservationStatus;
        bookings: number;
        covers: number;
      }>([
        { $match: { date: ctx.today } },
        {
          $group: {
            _id: '$status',
            bookings: { $sum: 1 },
            covers: { $sum: '$partySize' },
          },
        },
      ]),
      this.reservationModel.countDocuments({
        status: 'pending',
        startsAt: { $gte: ctx.now },
      }),
      this.reservationModel
        .find({
          date: ctx.today,
          status: { $in: ['pending', 'confirmed'] },
          startsAt: { $gte: soon },
        })
        .sort({ startsAt: 1 })
        .limit(6)
        .lean<
          (Row &
            Pick<
              Reservation,
              | 'number'
              | 'time'
              | 'name'
              | 'partySize'
              | 'status'
              | 'occasion'
              | 'table'
            >)[]
        >(),
      this.reservationModel.aggregate<{
        _id: string;
        bookings: number;
        covers: number;
        pending: number;
      }>([
        {
          $match: {
            date: { $gte: ctx.today, $lte: weekEnd },
            status: {
              $in: ['pending', 'confirmed', 'seated', 'completed', 'no_show'],
            },
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

    const of = (status: ReservationStatus) =>
      byStatus.find((s) => s._id === status);
    const counted: ReservationStatus[] = [
      'pending',
      'confirmed',
      'seated',
      'completed',
      'no_show',
    ];
    const live = byStatus.filter((s) => counted.includes(s._id));

    return {
      enabled,
      summary: {
        bookings: live.reduce((sum, s) => sum + s.bookings, 0),
        covers: live
          .filter((s) => s._id !== 'no_show')
          .reduce((sum, s) => sum + s.covers, 0),
        pending: of('pending')?.bookings ?? 0,
        confirmed: of('confirmed')?.bookings ?? 0,
        seated: of('seated')?.bookings ?? 0,
        completed: of('completed')?.bookings ?? 0,
        noShow: of('no_show')?.bookings ?? 0,
      },
      requests,
      next: next.map((r) => ({
        id: r._id.toString(),
        number: r.number,
        time: r.time,
        name: r.name,
        partySize: r.partySize,
        status: r.status,
        ...(r.occasion && { occasion: r.occasion }),
        ...(r.table && { table: r.table }),
      })),
      week: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(ctx.today, i).date;
        const row = week.find((w) => w._id === date);
        return {
          date,
          bookings: row?.bookings ?? 0,
          covers: row?.covers ?? 0,
          pending: row?.pending ?? 0,
        };
      }),
    };
  }

  private async menuWatch(): Promise<MenuWatch> {
    const [soldOut, soldOutCount, dishes] = await Promise.all([
      this.itemModel
        .find({ isActive: true, isAvailable: false }, { name: 1, image: 1 })
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean<(Row & { name: string; image?: string })[]>(),
      this.itemModel.countDocuments({ isActive: true, isAvailable: false }),
      this.itemModel.countDocuments({ isActive: true }),
    ]);
    return {
      soldOut: soldOut.map((d) => ({
        id: d._id.toString(),
        name: d.name,
        image: mediaUrl(d.image),
      })),
      soldOutCount,
      dishes,
    };
  }

  private async messagesWatch(enabled: boolean): Promise<MessagesWatch> {
    const unreadFilter = { folder: 'inbox' as const, status: 'new' as const };
    const [unread, latest] = await Promise.all([
      this.messageModel.countDocuments(unreadFilter),
      this.messageModel
        .find(unreadFilter, { name: 1, subject: 1, body: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(4)
        .lean<
          (Row & {
            name: string;
            subject: string;
            body: string;
            createdAt: Date;
          })[]
        >(),
    ]);
    return {
      enabled,
      unread,
      latest: latest.map((m) => ({
        id: m._id.toString(),
        name: m.name,
        subject: m.subject,
        preview: m.body.replace(/\s+/g, ' ').slice(0, 120),
        createdAt: new Date(m.createdAt).toISOString(),
      })),
    };
  }

  private async activity(
    ctx: Ctx,
    can: { orders: boolean; reservations: boolean; messages: boolean },
  ): Promise<ActivityItem[]> {
    const since = new Date(ctx.now.getTime() - DAY_MS);
    const events = (
      extra: PipelineStage.Project['$project'],
    ): PipelineStage[] => [
      { $match: { updatedAt: { $gte: since } } },
      { $project: { ...extra, history: 1 } },
      { $unwind: '$history' },
      {
        $match: {
          'history.at': { $gte: since },
          'history.status': { $nin: ['awaiting_payment'] },
        },
      },
      { $sort: { 'history.at': -1 } },
      { $limit: ACTIVITY_SIZE },
    ];
    type Event = {
      _id: Types.ObjectId;
      history: { status: string; at: Date; by?: string };
    };
    type OrderEvent = Event & {
      number: string;
      type: OrderType;
      customer?: { name: string };
    };
    type BookingEvent = Event & {
      number: string;
      name: string;
      partySize: number;
      date: string;
      time: string;
    };
    type NewMessage = Row & { name: string; subject: string; createdAt: Date };
    const none = <T>(): Promise<T[]> => Promise.resolve([]);

    const [orders, reservations, messages] = await Promise.all([
      can.orders
        ? this.orderModel
            .aggregate<OrderEvent>(
              events({ number: 1, type: 1, 'customer.name': 1 }),
            )
            .exec()
        : none<OrderEvent>(),
      can.reservations
        ? this.reservationModel
            .aggregate<BookingEvent>(
              events({ number: 1, name: 1, partySize: 1, date: 1, time: 1 }),
            )
            .exec()
        : none<BookingEvent>(),
      can.messages
        ? this.messageModel
            .find(
              { createdAt: { $gte: since }, folder: { $ne: 'spam' } },
              { name: 1, subject: 1, createdAt: 1 },
            )
            .sort({ createdAt: -1 })
            .limit(ACTIVITY_SIZE)
            .lean<NewMessage[]>()
            .exec()
        : none<NewMessage>(),
    ]);

    const items: ActivityItem[] = [
      ...orders.map((o, i): ActivityItem => ({
        key: `o-${o._id.toString()}-${i}`,
        kind: 'order',
        id: o._id.toString(),
        number: o.number,
        status: o.history.status,
        type: o.type,
        name: o.customer?.name ?? '',
        ...(o.history.by && { by: o.history.by }),
        at: new Date(o.history.at).toISOString(),
      })),
      ...reservations.map((r, i): ActivityItem => ({
        key: `r-${r._id.toString()}-${i}`,
        kind: 'reservation',
        id: r._id.toString(),
        number: r.number,
        status: r.history.status,
        name: r.name,
        partySize: r.partySize,
        date: r.date,
        time: r.time,
        ...(r.history.by && { by: r.history.by }),
        at: new Date(r.history.at).toISOString(),
      })),
      ...messages.map((m): ActivityItem => ({
        key: `m-${m._id.toString()}`,
        kind: 'message',
        id: m._id.toString(),
        name: m.name,
        subject: m.subject,
        at: new Date(m.createdAt).toISOString(),
      })),
    ];
    return items
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, ACTIVITY_SIZE);
  }

  private async sales(
    ctx: Ctx,
    range: OverviewRange,
    withCovers: boolean,
  ): Promise<Sales> {
    const from = addDays(ctx.today, -(range - 1)).date;
    const start = zonedToDate(`${from}T00:00`, ctx.timezone);
    const prevStart = zonedToDate(
      `${addDays(from, -range).date}T00:00`,
      ctx.timezone,
    );
    const prevEnd = new Date(ctx.now.getTime() - range * DAY_MS);
    const lastWeekStart = new Date(ctx.startOfToday.getTime() - 7 * DAY_MS);
    const lastWeekNow = new Date(ctx.now.getTime() - 7 * DAY_MS);
    const current = { $gte: ['$placedAt', start] };
    const tz = ctx.timezone;

    type Facets = {
      totals: {
        _id: 'cur' | 'prev';
        orders: number;
        revenue: number;
        cancelled: number;
        prep: number | null;
      }[];
      daily: { _id: string; orders: number; revenue: number }[];
      top: {
        _id: Types.ObjectId;
        name: string;
        quantity: number;
        revenue: number;
      }[];
      channels: { _id: OrderType; orders: number; revenue: number }[];
      payments: { _id: 'card' | 'cash'; orders: number; revenue: number }[];
      heatmap: { _id: { day: number; hour: number }; orders: number }[];
    };
    const notCancelled: PipelineStage.Match = {
      $match: { status: { $ne: 'cancelled' } },
    };
    const onlyCurrent: PipelineStage.Match = { $match: { $expr: current } };

    const [[facets], today, covers] = await Promise.all([
      this.orderModel.aggregate<Facets>([
        {
          $match: {
            ...REAL_ORDER,
            $or: [
              { placedAt: { $gte: start, $lte: ctx.now } },
              { placedAt: { $gte: prevStart, $lte: prevEnd } },
            ],
          },
        },
        { $addFields: { net: NET } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: { $cond: [current, 'cur', 'prev'] },
                  orders: {
                    $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, 1] },
                  },
                  revenue: { $sum: '$net' },
                  cancelled: {
                    $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
                  },
                  prep: { $avg: PREP_MINUTES },
                },
              },
            ],
            daily: [
              notCancelled,
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$placedAt',
                      timezone: tz,
                    },
                  },
                  orders: { $sum: 1 },
                  revenue: { $sum: '$net' },
                },
              },
            ],
            top: [
              onlyCurrent,
              notCancelled,
              { $unwind: '$lines' },
              {
                $group: {
                  _id: '$lines.itemId',
                  name: { $last: '$lines.name' },
                  quantity: { $sum: '$lines.quantity' },
                  revenue: { $sum: '$lines.total' },
                },
              },
              { $sort: { quantity: -1, revenue: -1 } },
              { $limit: 8 },
            ],
            channels: [
              onlyCurrent,
              notCancelled,
              {
                $group: {
                  _id: '$type',
                  orders: { $sum: 1 },
                  revenue: { $sum: '$net' },
                },
              },
            ],
            payments: [
              onlyCurrent,
              notCancelled,
              {
                $group: {
                  _id: '$payment.method',
                  orders: { $sum: 1 },
                  revenue: { $sum: '$net' },
                },
              },
            ],
            heatmap: [
              onlyCurrent,
              notCancelled,
              {
                $group: {
                  _id: {
                    day: { $isoDayOfWeek: { date: '$placedAt', timezone: tz } },
                    hour: { $hour: { date: '$placedAt', timezone: tz } },
                  },
                  orders: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]),
      this.orderModel.aggregate<{ _id: 'today' | 'lastWeek'; revenue: number }>(
        [
          {
            $match: {
              ...REAL_ORDER,
              $or: [
                { placedAt: { $gte: ctx.startOfToday, $lte: ctx.now } },
                { placedAt: { $gte: lastWeekStart, $lte: lastWeekNow } },
              ],
            },
          },
          {
            $group: {
              _id: {
                $cond: [
                  { $gte: ['$placedAt', ctx.startOfToday] },
                  'today',
                  'lastWeek',
                ],
              },
              revenue: { $sum: NET },
            },
          },
        ],
      ),
      withCovers
        ? this.coversCompare(from, range, ctx.today)
        : Promise.resolve({ value: 0, previous: 0 }),
    ]);

    const cur = facets?.totals.find((t) => t._id === 'cur');
    const prev = facets?.totals.find((t) => t._id === 'prev');
    const avg = (t?: { orders: number; revenue: number }) =>
      t && t.orders ? money(t.revenue / t.orders) : 0;
    const dayRow = (date: string) => facets?.daily.find((d) => d._id === date);

    return {
      range,
      from,
      revenue: { value: money(cur?.revenue), previous: money(prev?.revenue) },
      orders: { value: cur?.orders ?? 0, previous: prev?.orders ?? 0 },
      average: { value: avg(cur), previous: avg(prev) },
      covers,
      avgPrepMinutes: {
        value: round(cur?.prep ?? 0),
        previous: round(prev?.prep ?? 0),
      },
      cancelled: { value: cur?.cancelled ?? 0, previous: prev?.cancelled ?? 0 },
      todayRevenue: {
        value: money(today.find((t) => t._id === 'today')?.revenue),
        previous: money(today.find((t) => t._id === 'lastWeek')?.revenue),
      },
      daily: Array.from({ length: range }, (_, i) => {
        const date = addDays(from, i).date;
        const row = dayRow(date);
        const before = dayRow(addDays(date, -range).date);
        return {
          date,
          revenue: money(row?.revenue),
          orders: row?.orders ?? 0,
          previousRevenue: money(before?.revenue),
          previousOrders: before?.orders ?? 0,
        };
      }),
      topDishes: (facets?.top ?? []).map((d) => ({
        name: d.name,
        quantity: d.quantity,
        revenue: money(d.revenue),
      })),
      channels: (facets?.channels ?? [])
        .map((c) => ({
          type: c._id,
          orders: c.orders,
          revenue: money(c.revenue),
        }))
        .sort((a, b) => b.orders - a.orders),
      payments: (facets?.payments ?? [])
        .map((p) => ({
          method: p._id,
          orders: p.orders,
          revenue: money(p.revenue),
        }))
        .sort((a, b) => b.orders - a.orders),
      heatmap: (facets?.heatmap ?? []).map((h) => ({
        day: h._id.day,
        hour: h._id.hour,
        orders: h.orders,
      })),
    };
  }

  private async coversCompare(
    from: string,
    range: number,
    today: string,
  ): Promise<Compare> {
    const prevFrom = addDays(from, -range).date;
    const prevTo = addDays(today, -range).date;
    const rows = await this.reservationModel.aggregate<{
      _id: 'cur' | 'prev';
      covers: number;
    }>([
      {
        $match: {
          status: { $in: ['seated', 'completed'] },
          $or: [
            { date: { $gte: from, $lte: today } },
            { date: { $gte: prevFrom, $lte: prevTo } },
          ],
        },
      },
      {
        $group: {
          _id: { $cond: [{ $gte: ['$date', from] }, 'cur', 'prev'] },
          covers: { $sum: '$partySize' },
        },
      },
    ]);
    return {
      value: rows.find((r) => r._id === 'cur')?.covers ?? 0,
      previous: rows.find((r) => r._id === 'prev')?.covers ?? 0,
    };
  }
}

type Ctx = { now: Date; today: string; timezone: string; startOfToday: Date };
