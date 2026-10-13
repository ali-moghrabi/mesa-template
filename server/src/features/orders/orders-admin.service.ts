import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types, type QueryFilter, type Model } from 'mongoose';
import type { CurrentActor } from 'decorators/current-user.decorator';
import { PRICE_UNIT } from 'lib/constants/menuConstants';
import { mediaUrl } from 'lib/media-url';
import { fromMinor, toMinor } from 'lib/money';
import { addDays } from 'lib/opening-hours';
import { toStripeAmount, zonedToDate, type OrderType } from 'lib/ordering';
import type { Env } from 'src/config/env';
import { MenuItem, type MenuItemDocument } from 'src/schemas/item.schema';
import {
  Order,
  type OrderDocument,
  type OrderLine,
  type OrderStatus,
} from 'src/schemas/order.schema';
import { PromotionsService } from 'src/features/promotions/promotions.service';
import type {
  ChangeStatusDto,
  EditLineDto,
  EditOrderDto,
  ListOrdersQuery,
  RefundDto,
} from './dto/admin-order.dto';
import { OrderingConfig } from './ordering.config';
import {
  ACTIVE_STATUSES,
  OrdersService,
  sign,
  type OrderRow,
  type OrderView,
} from './orders.service';
import { StripeService } from './stripe.service';

export type AdminOrderSummary = {
  id: string;
  number: string;
  status: OrderStatus;
  type: OrderType;
  placedAt: string;
  customer: { name: string; phone: string };
  preview: string;
  itemCount: number;
  total: number;
  currency: string;
  payment: { method: 'card' | 'cash'; status: string };
  schedule: { asap: boolean; for?: string; from: string; to: string };
  area?: string;
  hasNotes: boolean;
  version: string;
};

export type AdminOrder = Omit<OrderView, 'history' | 'payment'> & {
  version: string;
  placedAt: string | null;
  editedAt: string | null;
  staffNote: string;
  cancelReason?: string;
  payment: OrderView['payment'] & {
    amountPaid?: number;
    refunded: number;
    refunds: {
      id: string;
      amount: number;
      at: string;
      by: string;
      reason?: string;
    }[];
    balance: number;
  };
  history: { status: string; at: string; by?: string; note?: string }[];
  next: OrderStatus | null;
};

export type Board = {
  active: AdminOrderSummary[];
  done: AdminOrderSummary[];
  counts: Record<'placed' | 'accepted' | 'preparing' | 'ready', number>;
  serverTime: string;
};

export type OrdersPage = {
  items: AdminOrderSummary[];
  total: number;
  page: number;
  pages: number;
};
export type OrdersFeed = {
  orders: AdminOrderSummary[];
  waiting: number;
  serverTime: string;
};

export const STEPS: Record<OrderType, OrderStatus[]> = {
  delivery: [
    'placed',
    'accepted',
    'preparing',
    'out_for_delivery',
    'completed',
  ],
  pickup: ['placed', 'accepted', 'preparing', 'ready', 'completed'],
};

const FINAL: OrderStatus[] = ['completed', 'cancelled'];
const PAGE_SIZE = 20;
const DONE_WINDOW_MS = 12 * 60 * 60_000;

export function canMove(
  type: OrderType,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (FINAL.includes(from) || from === 'awaiting_payment' || from === to)
    return false;
  if (to === 'cancelled') return true;
  const steps = STEPS[type];
  const a = steps.indexOf(from);
  const b = steps.indexOf(to);
  return a >= 0 && b >= 0 && (b > a || b === a - 1);
}

export const nextStatus = (
  type: OrderType,
  status: OrderStatus,
): OrderStatus | null => {
  const steps = STEPS[type];
  const i = steps.indexOf(status);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const versionOf = (order: { updatedAt?: Date }) =>
  new Date(order.updatedAt ?? 0).toISOString();

type DishRow = {
  _id: Types.ObjectId;
  name: string;
  image?: string;
  categoryId: Types.ObjectId;
  isActive: boolean;
  price: number;
  variants?: {
    _id: Types.ObjectId;
    name: string;
    price: number;
    isAvailable?: boolean;
  }[];
  modifierGroups?: {
    name: string;
    minSelect: number;
    maxSelect: number;
    options: {
      _id: Types.ObjectId;
      name: string;
      priceDelta?: number;
      isAvailable?: boolean;
    }[];
  }[];
};

@Injectable()
export class OrdersAdminService {
  private readonly logger = new Logger(OrdersAdminService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(MenuItem.name)
    private readonly itemModel: Model<MenuItemDocument>,
    private readonly orders: OrdersService,
    private readonly ordering: OrderingConfig,
    private readonly promotions: PromotionsService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async board(): Promise<Board> {
    const since = new Date(Date.now() - DONE_WINDOW_MS);
    const [active, done] = await Promise.all([
      this.orderModel
        .find({ status: { $in: ACTIVE_STATUSES }, placedAt: { $exists: true } })
        .sort({ placedAt: 1 })
        .limit(300)
        .lean<OrderRow[]>(),
      this.orderModel
        .find({
          status: { $in: FINAL },
          placedAt: { $exists: true },
          updatedAt: { $gte: since },
        })
        .sort({ updatedAt: -1 })
        .limit(40)
        .lean<OrderRow[]>(),
    ]);
    const counts = { placed: 0, accepted: 0, preparing: 0, ready: 0 };
    for (const o of active) {
      if (o.status === 'out_for_delivery' || o.status === 'ready')
        counts.ready++;
      else if (o.status in counts) counts[o.status as keyof typeof counts]++;
    }
    return {
      active: active.map(summary),
      done: done.map(summary),
      counts,
      serverTime: new Date().toISOString(),
    };
  }

  async feed(after?: string): Promise<OrdersFeed> {
    const since =
      after && !Number.isNaN(Date.parse(after))
        ? new Date(after)
        : new Date(Date.now() - 60_000);
    const [fresh, waiting] = await Promise.all([
      this.orderModel
        .find({ status: 'placed', placedAt: { $gt: since } })
        .sort({ placedAt: 1 })
        .limit(20)
        .lean<OrderRow[]>(),
      this.orderModel.countDocuments({
        status: 'placed',
        placedAt: { $exists: true },
      }),
    ]);
    return {
      orders: fresh.map(summary),
      waiting,
      serverTime: new Date().toISOString(),
    };
  }

  async list(query: ListOrdersQuery): Promise<OrdersPage> {
    const filter: QueryFilter<OrderDocument> = { placedAt: { $exists: true } };
    if (query.status === 'active') filter.status = { $in: ACTIVE_STATUSES };
    else if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;

    const q = query.q?.trim();
    if (q) {
      const digits = q.replace(/[^\d]/g, '');
      const text = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { number: q.replace(/^#/, '') },
        { 'customer.name': text },
        { 'customer.email': text },
        ...(digits.length >= 3
          ? [{ 'customer.phone': new RegExp(digits.split('').join('\\D*')) }]
          : []),
      ];
    }

    const tz = this.ordering.rules().timezone;
    if (query.from || query.to) {
      filter.placedAt = {
        $exists: true,
        ...(query.from && {
          $gte: zonedToDate(`${query.from.slice(0, 10)}T00:00`, tz),
        }),
        ...(query.to && {
          $lt: zonedToDate(
            `${addDays(query.to.slice(0, 10), 1).date}T00:00`,
            tz,
          ),
        }),
      };
    }

    const page = query.page ?? 1;
    const [rows, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ placedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<OrderRow[]>(),
      this.orderModel.countDocuments(filter),
    ]);
    return {
      items: rows.map(summary),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  async get(id: string): Promise<AdminOrder> {
    return this.adminView(await this.find(id));
  }

  async changeStatus(
    actor: CurrentActor,
    id: string,
    dto: ChangeStatusDto,
    canEdit: boolean,
  ): Promise<AdminOrder> {
    const order = await this.find(id);
    this.checkVersion(order, dto.version);
    if (order.status === 'awaiting_payment')
      throw new ConflictException(
        "This order isn't paid yet, so it isn't in the kitchen's hands.",
      );
    if (!canMove(order.type, order.status, dto.status)) {
      throw new ConflictException(
        `An order can't go from "${order.status.replace(/_/g, ' ')}" to "${dto.status.replace(/_/g, ' ')}".`,
      );
    }

    const now = new Date();
    const set: Record<string, unknown> = { status: dto.status };
    const refundable = this.refundable(order);

    if (dto.status === 'cancelled') {
      if (!dto.reason?.trim())
        throw new BadRequestException({
          statusCode: 400,
          message: 'Say why the order is cancelled',
          errors: { reason: 'Say why the order is cancelled' },
        });
      if (refundable > 0 && !canEdit)
        throw new ForbiddenException(
          'This order was paid by card. Only the owner can cancel it, because it needs a refund.',
        );
      set.cancelReason = dto.reason.trim();
    }

    if (
      dto.status === 'completed' &&
      order.payment.method === 'cash' &&
      order.payment.status !== 'paid'
    ) {
      set['payment.status'] = 'paid';
      set['payment.paidAt'] = now;
      set['payment.amountPaid'] = order.amounts.total;
    }

    const updated = await this.orderModel
      .findOneAndUpdate(
        { _id: order._id, updatedAt: order.updatedAt },
        {
          $set: set,
          $push: {
            history: {
              status: dto.status,
              at: now,
              by: actor.name,
              ...(dto.reason && { note: dto.reason.trim() }),
            },
          },
        },
        { new: true },
      )
      .lean<OrderRow>();
    if (!updated) throw changedMeanwhile();

    if (dto.status === 'cancelled' && dto.refund && refundable > 0) {
      return this.refundMinor(
        actor,
        updated,
        refundable,
        `Cancelled: ${dto.reason?.trim()}`,
      );
    }
    return this.adminView(updated);
  }

  async setStaffNote(id: string, note: string): Promise<AdminOrder> {
    const order = await this.find(id);
    const updated = await this.orderModel
      .findByIdAndUpdate(
        order._id,
        { $set: { staffNote: note } },
        { new: true },
      )
      .lean<OrderRow>();
    return this.adminView(updated!);
  }

  async editItems(
    actor: CurrentActor,
    id: string,
    dto: EditOrderDto,
  ): Promise<AdminOrder> {
    const order = await this.find(id, true);
    this.checkVersion(order, dto.version);
    if (!ACTIVE_STATUSES.includes(order.status))
      throw new ConflictException(
        'Only orders still in progress can be changed.',
      );

    const used = new Set<number>();
    const lines: OrderLine[] = [];
    for (const [i, line] of dto.lines.entries()) {
      if (line.index !== undefined) {
        const old = order.lines[line.index];
        if (!old || used.has(line.index))
          throw new BadRequestException(
            `Line ${i + 1} doesn't match the order. Reload and try again.`,
          );
        used.add(line.index);
        lines.push({
          ...old,
          quantity: line.quantity,
          note: line.note ?? old.note,
          total: old.unitPrice * line.quantity,
        });
      } else if (line.itemId) {
        lines.push(await this.priceNewLine(line));
      } else {
        throw new BadRequestException(`Line ${i + 1} is empty.`);
      }
    }

    const a = order.amounts;
    const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
    const savings = lines.reduce(
      (sum, l) =>
        sum +
        (l.unitWas !== undefined ? (l.unitWas - l.unitPrice) * l.quantity : 0),
      0,
    );
    const feeChanged =
      dto.deliveryFee !== undefined && order.type === 'delivery';
    const deliveryFee =
      order.type === 'pickup'
        ? 0
        : feeChanged
          ? toMinor(dto.deliveryFee!)
          : a.deliveryFee;
    const discount = Math.min(
      subtotal,
      dto.discount !== undefined ? toMinor(dto.discount) : (a.discount ?? 0),
    );
    const taxable = subtotal - discount + deliveryFee;
    const vat =
      a.vatRate > 0
        ? a.vatIncluded
          ? Math.round(taxable - taxable / (1 + a.vatRate))
          : Math.round(taxable * a.vatRate)
        : 0;
    const total = taxable + a.tip + (a.vatIncluded ? 0 : vat);

    const amounts = {
      ...a,
      subtotal,
      savings,
      deliveryFee,
      deliveryWaived: feeChanged ? 0 : a.deliveryWaived,
      discount,
      vat,
      total,
    };
    const checksum = sign(this.signingSecret(), { ...order, lines, amounts });
    const now = new Date();
    const updated = await this.orderModel
      .findOneAndUpdate(
        { _id: order._id, updatedAt: order.updatedAt },
        {
          $set: { lines, amounts, checksum, editedAt: now },
          $push: {
            history: {
              status: 'edited',
              at: now,
              by: actor.name,
              note: `${dto.reason} (total ${fmt(a.total)} → ${fmt(total)})`,
            },
          },
        },
        { new: true },
      )
      .lean<OrderRow>();
    if (!updated) throw changedMeanwhile();
    return this.adminView(updated);
  }

  async refund(
    actor: CurrentActor,
    id: string,
    dto: RefundDto,
  ): Promise<AdminOrder> {
    const order = await this.find(id);
    const amount = toMinor(dto.amount);
    const refundable = this.refundable(order);
    if (refundable <= 0)
      throw new ConflictException(
        'Nothing on this order can be refunded to a card.',
      );
    if (amount > refundable)
      throw new BadRequestException({
        statusCode: 400,
        message: `You can refund up to ${fmt(refundable)}.`,
        errors: { amount: `Up to ${fmt(refundable)}` },
      });
    return this.refundMinor(actor, order, amount, dto.reason);
  }

  private refundable(order: OrderRow): number {
    if (order.payment.method !== 'card' || !order.payment.intentId) return 0;
    if (order.payment.status !== 'paid' && order.payment.status !== 'refunded')
      return 0;
    return Math.max(
      0,
      (order.payment.amountPaid ?? order.amounts.total) -
        (order.payment.refunded ?? 0),
    );
  }

  private async refundMinor(
    actor: CurrentActor,
    order: OrderRow,
    amount: number,
    reason: string,
  ): Promise<AdminOrder> {
    const before = order.payment.refunded ?? 0;
    let refundId: string;
    try {
      const refund = await this.stripe.refund({
        intentId: order.payment.intentId!,
        amount: toStripeAmount(amount, order.currency, PRICE_UNIT),
        idempotencyKey: `refund-${String(order._id)}-${before}-${amount}`,
        reason,
      });
      refundId = refund.id;
    } catch (error) {
      this.logger.error(
        `Refund on order #${order.number} failed: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        `Stripe didn't accept the refund: ${(error as Error).message}`,
      );
    }

    const paid = order.payment.amountPaid ?? order.amounts.total;
    const now = new Date();

    const updated = await this.orderModel
      .findOneAndUpdate(
        {
          _id: order._id,
          'payment.refunded': order.payment.refunded ?? { $in: [0, null] },
        },
        {
          $inc: { 'payment.refunded': amount },
          ...(before + amount >= paid && {
            $set: { 'payment.status': 'refunded' },
          }),
          $push: {
            'payment.refunds': {
              id: refundId,
              amount,
              at: now,
              by: actor.name,
              reason,
            },
            history: {
              status: 'refunded',
              at: now,
              by: actor.name,
              note: `${fmt(amount)} back to the card. ${reason}`,
            },
          },
        },
        { new: true },
      )
      .lean<OrderRow>();
    return this.adminView(updated ?? (await this.find(String(order._id))));
  }

  private async priceNewLine(line: EditLineDto): Promise<OrderLine> {
    const dish = await this.itemModel
      .findById(line.itemId, {
        name: 1,
        image: 1,
        categoryId: 1,
        isActive: 1,
        price: 1,
        variants: 1,
        modifierGroups: 1,
      })
      .lean<DishRow>();
    if (!dish || !dish.isActive)
      throw new BadRequestException('That dish is no longer on the menu.');

    const variants = dish.variants ?? [];
    const variant = variants.find((v) => String(v._id) === line.variantId);
    if (variants.length > 0 && !variant)
      throw new BadRequestException(`Choose a size for ${dish.name}.`);

    const wanted = new Set(line.optionIds ?? []);
    const options: string[] = [];
    let extras = 0;
    for (const group of dish.modifierGroups ?? []) {
      const picked = group.options.filter((o) => wanted.has(String(o._id)));
      if (picked.length < group.minSelect)
        throw new BadRequestException(
          `Choose ${group.name.toLowerCase()} for ${dish.name}.`,
        );
      if (picked.length > group.maxSelect)
        throw new BadRequestException(
          `Up to ${group.maxSelect} for ${group.name.toLowerCase()}.`,
        );
      for (const o of picked) {
        options.push(`${group.name}: ${o.name}`);
        extras += o.priceDelta ?? 0;
        wanted.delete(String(o._id));
      }
    }
    if (wanted.size > 0)
      throw new BadRequestException(
        `Some choices for ${dish.name} changed. Pick them again.`,
      );

    const sale = (await this.promotions.pricing()).saleFor({
      id: String(dish._id),
      categoryId: String(dish.categoryId),
    });
    const list = variant ? variant.price : dish.price;
    const unitPrice = (sale ? sale.price(list) : list) + extras;
    const was = list + extras;
    return {
      itemId: dish._id,
      variantId: variant?._id,
      optionIds: (line.optionIds ?? []).map((o) => new Types.ObjectId(o)),
      name: dish.name,
      image: mediaUrl(dish.image),
      variantName: variant?.name,
      options,
      quantity: line.quantity,
      unitPrice,
      unitWas: sale && was > unitPrice ? was : undefined,
      total: unitPrice * line.quantity,
      note: line.note ?? '',
    };
  }

  private async find(id: string, withChecksum = false): Promise<OrderRow> {
    if (!isValidObjectId(id)) throw new NotFoundException('Order not found');
    const query = this.orderModel.findById(id);
    const order = await (
      withChecksum ? query.select('+checksum') : query
    ).lean<OrderRow>();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private checkVersion(order: OrderRow, version: string) {
    if (versionOf(order) !== version) throw changedMeanwhile();
  }

  private signingSecret(): string {
    const value: unknown = this.config.get('ORDER_SIGNING_SECRET', {
      infer: true,
    });
    const secret = typeof value === 'string' ? value.trim() : '';
    if (secret.length < 32)
      throw new ServiceUnavailableException('ORDER_SIGNING_SECRET is not set');
    return secret;
  }

  private adminView(order: OrderRow): AdminOrder {
    const view = this.orders.view(order, this.ordering.rules());
    const n = (minor: number | undefined) => fromMinor(minor ?? 0) ?? 0;
    const paid =
      order.payment.status === 'paid' || order.payment.status === 'refunded'
        ? (order.payment.amountPaid ?? order.amounts.total)
        : 0;
    const refunded = order.payment.refunded ?? 0;
    const balance =
      order.payment.method === 'card' && paid
        ? order.amounts.total - (paid - refunded)
        : 0;

    return {
      ...view,
      version: versionOf(order),
      placedAt: order.placedAt ? new Date(order.placedAt).toISOString() : null,
      editedAt: order.editedAt ? new Date(order.editedAt).toISOString() : null,
      staffNote: order.staffNote ?? '',
      cancelReason: order.cancelReason,
      payment: {
        ...view.payment,
        amountPaid: paid ? n(paid) : undefined,
        refunded: n(refunded),
        refunds: (order.payment.refunds ?? []).map((r) => ({
          ...r,
          amount: n(r.amount),
          at: new Date(r.at).toISOString(),
        })),
        balance:
          order.status === 'cancelled' ? -n(paid - refunded) : n(balance),
      },
      history: order.history.map((h) => ({
        status: h.status,
        at: new Date(h.at).toISOString(),
        by: h.by,
        note: h.note,
      })),
      next: nextStatus(order.type, order.status),
    };
  }
}

function summary(order: OrderRow): AdminOrderSummary {
  const names = order.lines
    .slice(0, 2)
    .map((l) => (l.quantity > 1 ? `${l.quantity}× ${l.name}` : l.name));
  const rest = order.lines.length - 2;
  return {
    id: String(order._id),
    number: order.number,
    status: order.status,
    type: order.type,
    placedAt: new Date(order.placedAt ?? order.createdAt).toISOString(),
    customer: { name: order.customer.name, phone: order.customer.phone },
    preview: names.join(', ') + (rest > 0 ? ` +${rest}` : ''),
    itemCount: order.lines.reduce((sum, l) => sum + l.quantity, 0),
    total: fromMinor(order.amounts.total) ?? 0,
    currency: order.currency,
    payment: { method: order.payment.method, status: order.payment.status },
    schedule: {
      asap: order.schedule.asap,
      for: order.schedule.for,
      from: new Date(order.schedule.from).toISOString(),
      to: new Date(order.schedule.to).toISOString(),
    },
    area: order.address?.area,
    hasNotes: Boolean(
      order.notes || order.lines.some((l) => l.note) || order.staffNote,
    ),
    version: versionOf(order),
  };
}

const fmt = (minor: number) => (fromMinor(minor) ?? 0).toFixed(2);

const changedMeanwhile = () =>
  new ConflictException(
    'Someone else updated this order a moment ago. It has been refreshed, check it and try again.',
  );
