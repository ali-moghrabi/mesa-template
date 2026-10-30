import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isValidObjectId, Types, type Model } from 'mongoose';
import { PRICE_UNIT } from 'lib/constants/menuConstants';
import { formError, isDuplicateKey } from 'lib/form-errors';
import { fromMinor, toMinor } from 'lib/money';
import {
  getOpenStatus,
  type OpenStatus,
  type OpeningHours,
} from 'lib/opening-hours';
import {
  quote,
  timeSlots,
  sameGatewayAmount,
  toGatewayAmount,
  zonedToDate,
  type OrderingRules,
  type OrderType,
  type PaymentMethod,
  type Quote,
  type SlotDay,
} from 'lib/ordering';
import type { Env } from 'src/config/env';
import { Cart, type CartDocument } from 'src/schemas/cart.schema';
import {
  Counter,
  Order,
  type OrderAddress,
  type OrderDocument,
  type OrderStatus,
  shownMethod,
} from 'src/schemas/order.schema';
import { User, type UserDocument } from 'src/schemas/user.schema';
import { CartService, type CartView } from 'src/features/cart/cart.service';
import { MailService } from 'src/features/mail/mail.service';
import { orderConfirmationEmail } from 'src/features/mail/templates';
import { SettingsService } from 'src/features/settings/settings.service';
import type { PlaceOrderDto } from './dto/order.dto';
import { OrderingConfig } from './ordering.config';
import {
  PAYMENT_GATEWAY,
  type GatewayPayment,
  type PaymentGateway,
} from './payment-gateway';

export type CheckoutInfo = {
  cart: CartView;
  currency: string;
  priceUnit: number;
  vat: { rate: number; included: boolean };
  delivery: null | {
    fee: number;
    freeOver: number | null;
    minimumOrder: number;
    etaMinutes: [number, number];
    areas: { id: string; name: string; fee?: number; minimumOrder?: number }[];
    slots: SlotDay[];
  };
  pickup: null | {
    etaMinutes: [number, number];
    address: string;
    instructions: string;
    slots: SlotDay[];
  };
  payments: { online: boolean; cash: boolean };
  tips: number[];
  open: OpenStatus | null;
  scheduling: boolean;
  customer: { name: string; email: string; phone: string };
  lastAddress: Omit<OrderAddress, 'area'> | null;
  timezone: string;
};

export type OrderView = {
  id: string;
  number: string;
  status: OrderStatus;
  type: OrderType;
  currency: string;
  createdAt: string;
  payment: {
    method: PaymentMethod;
    status: string;
    cashChangeFor?: number;
    lastError?: string;
    paidAt?: string;
  };
  lines: {
    name: string;
    image?: string;
    variantName?: string;
    options: string[];
    quantity: number;
    unitPrice: number;
    unitWas?: number;
    total: number;
    note: string;
  }[];
  amounts: {
    subtotal: number;
    savings: number;
    deliveryFee: number;
    deliveryWaived: number;
    tip: number;
    vat: number;
    vatIncluded: boolean;
    vatRate: number;
    discount: number;
    total: number;
  };
  customer: { name: string; phone: string; email: string };
  address?: OrderAddress;
  pickupAddress?: string;
  schedule: {
    asap: boolean;
    for?: string;
    from: string;
    to: string;
    timezone: string;
  };
  notes: string;
  cutlery: boolean;
  history: { status: string; at: string }[];
};

export type PlacedOrder = { order: OrderView; paymentUrl?: string };

export type OrderRow = Order & { _id: Types.ObjectId; checksum?: string };

export type MyOrders = {
  active: OrderView[];
  past: OrderView[];
  nextBefore: string | null;
};
export type ReorderResult = {
  cart: CartView;
  added: number;
  skipped: { name: string; reason: string }[];
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  'placed',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
];
const PAST_STATUSES: OrderStatus[] = ['completed', 'cancelled'];
const PAST_PAGE = 10;

const SLOT_GRACE_MS = 10 * 60_000;
const UNPAID_KEEP_MS = 30 * 24 * 60 * 60_000;
const FIRST_NUMBER = 1000;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly cart: CartService,
    private readonly settings: SettingsService,
    private readonly ordering: OrderingConfig,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async checkout(userId: string): Promise<CheckoutInfo> {
    const rules = this.enabledRules();
    const [cart, hours, user, last] = await Promise.all([
      this.cart.view(userId),
      this.hours(),
      this.userModel
        .findById(userId, { firstName: 1, lastName: 1, email: 1, phone: 1 })
        .lean<{
          firstName: string;
          lastName: string;
          email: string;
          phone?: string;
        }>(),
      this.orderModel
        .findOne(
          {
            userId: new Types.ObjectId(userId),
            type: 'delivery',
            status: { $nin: ['awaiting_payment', 'cancelled'] },
          },
          { address: 1 },
        )
        .sort({ createdAt: -1 })
        .lean<{ address?: OrderAddress }>(),
    ]);
    if (!user) throw new NotFoundException('Your account was not found');

    const slots = (lead: number) =>
      rules.scheduling.enabled
        ? timeSlots(hours, {
            daysAhead: rules.scheduling.daysAhead,
            slotMinutes: rules.scheduling.slotMinutes,
            leadMinutes: lead,
          })
        : [];
    const n = (minor: number) => fromMinor(minor) ?? 0;
    const saved = last?.address;
    const lastAddress = saved
      ? {
          areaId: saved.areaId,
          street: saved.street,
          building: saved.building,
          floor: saved.floor,
          apartment: saved.apartment,
          directions: saved.directions,
        }
      : null;

    return {
      cart,
      currency: rules.currency,
      priceUnit: PRICE_UNIT,
      vat: rules.vat,
      delivery: rules.delivery && {
        fee: n(rules.delivery.fee),
        freeOver:
          rules.delivery.freeOver === null ? null : n(rules.delivery.freeOver),
        minimumOrder: n(rules.delivery.minimumOrder),
        etaMinutes: rules.delivery.etaMinutes,
        areas: rules.delivery.areas.map((a) => ({
          id: a.id,
          name: a.name,
          ...(a.fee !== undefined && { fee: n(a.fee) }),
          ...(a.minimumOrder !== undefined && {
            minimumOrder: n(a.minimumOrder),
          }),
        })),
        slots: slots(rules.delivery.etaMinutes[0]),
      },
      pickup: rules.pickup && {
        ...rules.pickup,
        slots: slots(rules.pickup.etaMinutes[0]),
      },
      payments: {
        online: rules.payments.online && this.gateway.enabled,
        cash: rules.payments.cash,
      },
      tips: rules.tips,
      open: hours ? getOpenStatus(hours) : null,
      scheduling: rules.scheduling.enabled,
      customer: {
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        phone: user.phone ?? '',
      },
      lastAddress,
      timezone: hours?.timezone ?? rules.timezone,
    };
  }

  async place(userId: string, dto: PlaceOrderDto): Promise<PlacedOrder> {
    const owner = new Types.ObjectId(userId);

    const existing = await this.orderModel
      .findOne({ userId: owner, idempotencyKey: dto.idempotencyKey })
      .lean<OrderRow>();
    if (existing) return this.resume(existing);

    const rules = this.enabledRules();
    const secret = this.signingSecret();

    const kind = dto.type === 'delivery' ? rules.delivery : rules.pickup;
    if (!kind)
      throw formError(
        {
          type: `${dto.type === 'delivery' ? 'Delivery' : 'Pickup'} isn't available`,
        },
        'Choose another way to get your order',
      );
    if (
      dto.paymentMethod === 'online' &&
      !(rules.payments.online && this.gateway.enabled)
    )
      throw formError({ paymentMethod: 'Paying online is off right now' });
    if (dto.paymentMethod === 'cash' && !rules.payments.cash)
      throw formError({ paymentMethod: 'Cash payments are off right now' });

    const cart = await this.cart.view(userId);
    if (cart.lines.length === 0)
      throw new ConflictException('Your cart is empty');
    if (!cart.ready)
      throw new ConflictException(
        'Some dishes in your cart need your attention first',
      );

    let address: OrderAddress | undefined;
    if (dto.type === 'delivery') {
      if (!dto.address)
        throw formError({ 'address.street': 'Enter your address' });
      const areas = rules.delivery!.areas;
      const area = areas.find((a) => a.id === dto.address!.areaId);
      if (areas.length > 0 && !area)
        throw formError({ 'address.areaId': 'Choose your area' });
      address = {
        areaId: area?.id,
        area: area?.name,
        street: dto.address.street,
        building: dto.address.building ?? '',
        floor: dto.address.floor ?? '',
        apartment: dto.address.apartment ?? '',
        directions: dto.address.directions ?? '',
      };
    }

    const hours = await this.hours();
    const timezone = hours?.timezone ?? rules.timezone;
    const [etaFrom, etaTo] = kind.etaMinutes;
    const now = Date.now();
    let schedule: Order['schedule'];
    if (dto.scheduledFor) {
      if (!rules.scheduling.enabled)
        throw formError({
          scheduledFor: 'Ordering ahead is off. Order for now instead.',
        });
      const options = {
        daysAhead: rules.scheduling.daysAhead,
        slotMinutes: rules.scheduling.slotMinutes,
        leadMinutes: etaFrom,
      };
      const allowed = timeSlots(
        hours,
        options,
        new Date(now - SLOT_GRACE_MS),
      ).some((d) => d.times.some((t) => t.value === dto.scheduledFor));
      if (!allowed)
        throw formError({
          scheduledFor: 'This time is no longer available. Pick another one.',
        });
      const at = zonedToDate(dto.scheduledFor, timezone);
      schedule = {
        asap: false,
        for: dto.scheduledFor,
        from: at,
        to: new Date(at.getTime() + rules.scheduling.slotMinutes * 60_000),
        timezone,
      };
    } else {
      if (hours && !getOpenStatus(hours).open)
        throw formError(
          { scheduledFor: "We're closed right now. Choose a time for later." },
          "We're closed right now",
        );
      schedule = {
        asap: true,
        from: new Date(now + etaFrom * 60_000),
        to: new Date(now + etaTo * 60_000),
        timezone,
      };
    }

    const tipPercent = dto.tipPercent ?? 0;
    if (tipPercent !== 0 && !rules.tips.includes(tipPercent))
      throw formError({ tipPercent: 'Choose a tip from the list' });

    const items = cart.lines.reduce((sum, l) => sum + toMinor(l.total), 0);
    const bill = quote(
      { subtotal: items, savings: toMinor(cart.savings) },
      dto.type,
      rules,
      { areaId: address?.areaId, tipPercent },
    );
    if (bill.belowMinimum > 0) {
      throw new ConflictException(
        `Delivery starts from ${this.format(bill.minimumOrder, rules.currency)}. Add ${this.format(bill.belowMinimum, rules.currency)} more, or pick it up.`,
      );
    }
    if (toMinor(dto.expectedTotal) !== bill.total) {
      throw new ConflictException({
        statusCode: 409,
        code: 'TOTAL_CHANGED',
        message: `Prices changed while you were checking out. The new total is ${this.format(bill.total, rules.currency)}.`,
      });
    }

    let cashChangeFor: number | undefined;
    if (dto.paymentMethod === 'cash' && dto.cashChangeFor) {
      cashChangeFor = toMinor(dto.cashChangeFor);
      if (cashChangeFor < bill.total)
        throw formError({
          cashChangeFor: `That's less than the total (${this.format(bill.total, rules.currency)})`,
        });
    }

    const user = await this.userModel
      .findById(userId, { firstName: 1, lastName: 1, email: 1, phone: 1 })
      .lean<{
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
      }>();
    if (!user) throw new NotFoundException('Your account was not found');

    // Only one unpaid online order at a time: an earlier one is abandoned now
    await this.abandonUnpaid(owner);

    const id = new Types.ObjectId();
    const online = dto.paymentMethod === 'online';
    const draft: Omit<Order, 'createdAt' | 'updatedAt' | 'checksum'> & {
      _id: Types.ObjectId;
    } = {
      _id: id,
      number: await this.nextNumber(),
      userId: owner,
      status: online ? 'awaiting_payment' : 'placed',
      type: dto.type,
      payment: {
        method: dto.paymentMethod,
        status: 'unpaid',
        refunded: 0,
        refunds: [],
        ...(cashChangeFor !== undefined ? { cashChangeFor } : {}),
      },
      lines: cart.lines.map((l) => ({
        itemId: new Types.ObjectId(l.dish.id),
        variantId: l.variant ? new Types.ObjectId(l.variant.id) : undefined,
        optionIds: l.options.map((o) => new Types.ObjectId(o.id)),
        name: l.dish.name,
        image: l.dish.image,
        variantName: l.variant?.name,
        options: l.options.map((o) => `${o.group}: ${o.name}`),
        quantity: l.quantity,
        unitPrice: toMinor(l.unitPrice),
        unitWas: l.unitWas === undefined ? undefined : toMinor(l.unitWas),
        total: toMinor(l.total),
        note: l.note,
      })),
      amounts: { ...pickAmounts(bill), vatRate: rules.vat.rate, discount: 0 },
      currency: rules.currency,
      customer: {
        name: `${user.firstName} ${user.lastName}`.trim(),
        phone: dto.phone,
        email: user.email,
      },
      address,
      schedule,
      notes: dto.notes ?? '',
      staffNote: '',
      cutlery: dto.cutlery ?? false,
      cartLineIds: cart.lines.map((l) => new Types.ObjectId(l.id)),
      idempotencyKey: dto.idempotencyKey,
      history: [
        { status: online ? 'awaiting_payment' : 'placed', at: new Date() },
      ],
      ...(!online && { placedAt: new Date() }),
      // An online checkout that's never paid cleans itself up (kept while it can still be paid)
      ...(online && { expiresAt: new Date(now + UNPAID_KEEP_MS) }),
    };
    const checksum = sign(secret, draft);

    let order: OrderRow;
    try {
      order = (await this.orderModel.create({ ...draft, checksum })).toObject();
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      // The same submit raced itself: answer with the one that won
      const won = await this.orderModel
        .findOne({ userId: owner, idempotencyKey: dto.idempotencyKey })
        .lean<OrderRow>();
      if (!won) throw error;
      return this.resume(won);
    }

    // Remember the phone for next time, if the account had none
    if (!user.phone)
      await this.userModel.updateOne(
        { _id: owner, phone: { $in: [null, ''] } },
        { $set: { phone: dto.phone } },
      );

    if (!online) {
      await this.afterPlaced(order);
      return { order: this.view(order, rules) };
    }

    // Online: a payment for exactly this order's total, on the provider's secure page
    return this.startPayment(order, rules);
  }

  /**
   * An order already created for this submit (a retry): its payment page again, or a new
   * attempt when the last one failed or expired
   */
  private async resume(order: OrderRow): Promise<PlacedOrder> {
    const rules = this.ordering.rules();
    if (order.status !== 'awaiting_payment' || order.payment.method === 'cash')
      return { order: this.view(order, rules) };

    if (order.payment.chargeId) {
      const payment = await this.gateway
        .check(order.payment.chargeId)
        .catch(() => null);
      if (!payment)
        throw new BadGatewayException(
          "Online payments aren't answering right now. Try again in a moment, or pay cash.",
        );
      if (payment.status === 'paid') {
        const full = await this.withChecksum(order._id);
        if (full) await this.applyPayment(full, payment);
        return { order: await this.fresh(order, rules) };
      }
      // Still in progress: the same page
      if (payment.status === 'pending' && payment.url)
        return { order: this.view(order, rules), paymentUrl: payment.url };
    }
    // The last attempt failed or expired: a new payment for the same order
    return this.startPayment(order, rules);
  }

  /** A new online payment for this order (attempt n + 1): paymentUrl is the provider's page */
  private async startPayment(
    order: OrderRow,
    rules: OrderingRules,
  ): Promise<PlacedOrder> {
    const attempt = (order.payment.attempts ?? 0) + 1;
    const id = String(order._id);
    let payment: GatewayPayment;
    try {
      payment = await this.gateway.start({
        orderId: id,
        orderNumber: order.number,
        amount: toGatewayAmount(
          order.amounts.total,
          order.currency,
          PRICE_UNIT,
        ),
        currency: order.currency,
        description: `Order #${order.number}`,
        customer: {
          name: order.customer.name,
          email: order.customer.email,
          phone: order.customer.phone,
        },
        returnUrl: `${this.webUrl()}/payment/complete?order=${id}`,
        idempotencyKey: `order-${id}-${attempt}`,
      });
    } catch (error) {
      this.logger.error(
        `Online payment for order #${order.number} didn't start: ${(error as Error).message}`,
      );
      await this.orderModel.updateOne(
        { _id: order._id, status: 'awaiting_payment' },
        {
          $set: { status: 'cancelled' },
          $push: {
            history: {
              status: 'cancelled',
              at: new Date(),
              note: 'Online payment could not start',
            },
          },
        },
      );
      if (error instanceof ServiceUnavailableException) throw error;
      throw new BadGatewayException(
        "Online payments aren't answering right now. Try again in a moment, or pay cash.",
      );
    }

    await this.orderModel.updateOne(
      { _id: order._id },
      {
        $set: {
          'payment.chargeId': payment.id,
          'payment.attempts': attempt,
          'payment.status': 'unpaid',
        },
        $unset: { 'payment.lastError': 1 },
      },
    );

    // Still to be paid: the provider's page
    if (payment.status === 'pending') {
      if (payment.url) {
        order.payment.chargeId = payment.id;
        order.payment.attempts = attempt;
        order.payment.status = 'unpaid';
        delete order.payment.lastError;
        return { order: this.view(order, rules), paymentUrl: payment.url };
      }
      this.logger.error(
        `Order #${order.number}: payment ${payment.id} is pending with no page to send the guest to`,
      );
    }

    // Already decided: paid, or failed with the provider's reason
    const full = await this.withChecksum(order._id);
    if (full) await this.applyPayment(full, payment);
    return { order: await this.fresh(order, rules) };
  }

  /** The order as it is in the database now */
  private async fresh(
    order: OrderRow,
    rules: OrderingRules,
  ): Promise<OrderView> {
    const row = await this.orderModel.findById(order._id).lean<OrderRow>();
    return this.view(row ?? order, rules);
  }

  /* ───────────── online payment results ───────────── */

  /** /payment/complete calls this when the provider sends the guest back (its callback does the same) */
  async confirmPayment(userId: string, orderId: string): Promise<OrderView> {
    const order = await this.own(userId, orderId, true);
    if (
      order.payment.method !== 'cash' &&
      order.payment.chargeId &&
      order.status === 'awaiting_payment'
    ) {
      const payment = await this.gateway
        .check(order.payment.chargeId)
        .catch((error: Error) => {
          this.logger.warn(
            `Order #${order.number}: couldn't read payment ${order.payment.chargeId}: ${error.message}`,
          );
          return null;
        });
      if (payment) await this.applyPayment(order, payment);
      return this.get(userId, orderId);
    }
    return this.view(order, this.ordering.rules());
  }

  /**
   * For the provider's callback (its controller comes with the provider). The callback is only a
   * hint: the payment is read again from the provider, then matched to its order, so a forged
   * call can't mark anything paid.
   */
  async handlePaymentEvent(paymentId: string): Promise<void> {
    let payment: GatewayPayment;
    try {
      payment = await this.gateway.check(paymentId);
    } catch (error) {
      this.logger.warn(
        `Payment callback for ${paymentId}: couldn't read it: ${(error as Error).message}`,
      );
      return;
    }
    const order =
      payment.orderId && isValidObjectId(payment.orderId)
        ? await this.withChecksum(new Types.ObjectId(payment.orderId))
        : await this.orderModel
            .findOne({ 'payment.chargeId': payment.id })
            .select('+checksum')
            .lean<OrderRow>();
    if (!order) {
      this.logger.warn(`Payment callback for ${payment.id}: no matching order`);
      return;
    }
    await this.applyPayment(order, payment);
  }

  /** The provider's record → the order. Safe to run any number of times, from any path. */
  private async applyPayment(
    order: OrderRow,
    payment: GatewayPayment,
  ): Promise<void> {
    const expected = toGatewayAmount(
      order.amounts.total,
      order.currency,
      PRICE_UNIT,
    );
    const signed = sign(this.signingSecret(), order);
    const forThisOrder = payment.orderId
      ? payment.orderId === String(order._id)
      : payment.id === order.payment.chargeId;
    const genuine =
      forThisOrder &&
      sameGatewayAmount(payment.amount, expected, order.currency) &&
      String(payment.currency).toUpperCase() === order.currency.toUpperCase() &&
      sameHash(signed, order.checksum ?? '');

    if (!genuine) {
      this.logger.error(
        `Order #${order.number}: the payment ${payment.id} doesn't match the order. Not marked as paid.`,
      );
      await this.orderModel.updateOne(
        {
          _id: order._id,
          status: 'awaiting_payment',
          'payment.chargeId': payment.id,
        },
        {
          $set: {
            'payment.status': 'failed',
            'payment.lastError':
              "The payment didn't match this order. Please contact us.",
          },
        },
      );
      return;
    }

    if (payment.status === 'paid') {
      if (order.status === 'awaiting_payment') {
        const paidAt = new Date();
        const updated = await this.orderModel
          .findOneAndUpdate(
            { _id: order._id, status: 'awaiting_payment' },
            {
              $set: {
                status: 'placed',
                placedAt: paidAt,
                'payment.status': 'paid',
                'payment.paidAt': paidAt,
                'payment.amountPaid': order.amounts.total,
                'payment.chargeId': payment.id,
              },
              $unset: { 'payment.lastError': 1, expiresAt: 1 },
              $push: {
                history: { status: 'placed', at: paidAt, note: 'Paid online' },
              },
            },
            { returnDocument: 'after' },
          )
          .lean<OrderRow>();
        if (updated) {
          await this.afterPlaced(updated);
          return;
        }
        // Another path (the callback, the return page) got there first
        order = (await this.withChecksum(order._id)) ?? order;
      }
      const counted =
        order.payment.chargeId === payment.id &&
        (order.payment.status === 'paid' ||
          order.payment.status === 'refunded');
      // Money for an order that was abandoned, or a second payment: it goes straight back
      if (!counted) await this.refundStray(order, payment);
      return;
    }

    if (payment.status === 'pending') return; // the guest is still on the provider's page

    // Failed, cancelled, expired…: only the current attempt changes the order
    this.logger.warn(
      `Order #${order.number}: payment ${payment.id} failed${payment.failure ? ` (${payment.failure})` : ''}`,
    );
    await this.orderModel.updateOne(
      {
        _id: order._id,
        status: 'awaiting_payment',
        'payment.chargeId': payment.id,
      },
      {
        $set: {
          'payment.status': 'failed',
          'payment.lastError':
            payment.failure ??
            "The payment didn't go through, and you weren't charged. Try again, or pay cash.",
        },
      },
    );
  }

  /** A payment that doesn't belong to a live order is refunded automatically, once */
  private async refundStray(
    order: OrderRow,
    payment: GatewayPayment,
  ): Promise<void> {
    if (!this.gateway.refund) {
      this.logger.error(
        `Order #${order.number}: an extra payment (${payment.id}) arrived. Refund it from the payment provider's dashboard.`,
      );
      return;
    }
    try {
      const refund = await this.gateway.refund({
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        idempotencyKey: `stray-${payment.id}`,
        note: `Order #${order.number}: extra payment, refunded automatically`,
      });
      const note = `An extra online payment (${payment.id}) arrived and was refunded automatically (${refund.id}).`;
      await this.orderModel.updateOne(
        { _id: order._id, 'history.note': { $ne: note } },
        {
          $push: { history: { status: 'refunded', at: new Date(), note } },
          // Money moved on this order: keep the record
          $unset: { expiresAt: 1 },
        },
      );
      this.logger.warn(`Order #${order.number}: ${note}`);
    } catch (error) {
      this.logger.error(
        `Order #${order.number}: the extra payment ${payment.id} couldn't be refunded automatically. Refund it from the payment provider's dashboard. ${(error as Error).message}`,
      );
    }
  }

  private withChecksum(id: Types.ObjectId): Promise<OrderRow | null> {
    return this.orderModel
      .findById(id)
      .select('+checksum')
      .lean<OrderRow>()
      .exec();
  }

  /** The website's address, where the payment provider sends the guest back */
  private webUrl(): string {
    const read = (key: 'WEB_URL' | 'CLIENT_ORIGIN') => {
      const value: unknown = this.config.get(key, { infer: true });
      return typeof value === 'string' ? value : '';
    };
    const url =
      read('WEB_URL').trim() ||
      read('CLIENT_ORIGIN').split(',')[0]?.trim() ||
      '';
    return url.replace(/\/+$/, '');
  }

  /** Placed (cash, or paid online): the ordered dishes leave the cart, and the confirmation email goes once */
  private async afterPlaced(order: OrderRow): Promise<void> {
    await this.cartModel.updateOne(
      { userId: order.userId },
      { $pull: { lines: { _id: { $in: order.cartLineIds } } } },
    );

    const first = await this.orderModel.findOneAndUpdate(
      { _id: order._id, confirmedAt: { $exists: false } },
      { $set: { confirmedAt: new Date() } },
    );
    if (!first) return;
    const view = this.view(order, this.ordering.rules());
    const brand = this.mail.brand();
    this.mail
      .send(
        order.customer.email,
        orderConfirmationEmail(brand, {
          order: view,
          link: `${brand.webUrl}/account/orders/${view.id}`,
        }),
      )
      .catch((error: Error) =>
        this.logger.error(
          `Order #${order.number} email failed: ${error.message}`,
        ),
      );
  }

  /* ───────────── reading orders ───────────── */

  async get(userId: string, orderId: string): Promise<OrderView> {
    return this.view(await this.own(userId, orderId), this.ordering.rules());
  }

  /**
   * The person's orders for /account/orders. Unpaid online attempts are left out.
   *   active  everything still on its way (placed → out for delivery), newest first
   *   past    completed and cancelled, PAST_PAGE at a time; `before` continues from nextBefore
   */
  async mine(userId: string, before?: string): Promise<MyOrders> {
    const owner = new Types.ObjectId(userId);
    const rules = this.ordering.rules();
    const cursor =
      before && !Number.isNaN(Date.parse(before)) ? new Date(before) : null;

    const [active, past] = await Promise.all([
      cursor
        ? Promise.resolve([] as OrderRow[])
        : this.orderModel
            .find({ userId: owner, status: { $in: ACTIVE_STATUSES } })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean<OrderRow[]>(),
      this.orderModel
        .find({
          userId: owner,
          status: { $in: PAST_STATUSES },
          // Only orders that reached the kitchen: not checkouts abandoned before paying
          placedAt: { $exists: true },
          ...(cursor && { createdAt: { $lt: cursor } }),
        })
        .sort({ createdAt: -1 })
        .limit(PAST_PAGE + 1)
        .lean<OrderRow[]>(),
    ]);
    const more = past.length > PAST_PAGE;
    const page = past.slice(0, PAST_PAGE);
    return {
      active: active.map((r) => this.view(r, rules)),
      past: page.map((r) => this.view(r, rules)),
      nextBefore: more
        ? new Date(page[page.length - 1].createdAt).toISOString()
        : null,
    };
  }

  /** How many of the person's orders are still in progress (placed → out for delivery) */
  async activeCount(userId: string): Promise<{ count: number }> {
    const count = await this.orderModel.countDocuments({
      userId: new Types.ObjectId(userId),
      status: { $in: ACTIVE_STATUSES },
    });
    return { count };
  }

  /**
   * "Order again": the order's dishes go back in the cart with the same choices, priced today.
   * Dishes that are gone, sold out or changed are skipped and listed, so the guest knows.
   */
  async reorder(userId: string, orderId: string): Promise<ReorderResult> {
    const order = await this.own(userId, orderId);
    let added = 0;
    const skipped: ReorderResult['skipped'] = [];
    for (const line of order.lines) {
      try {
        await this.cart.add(userId, {
          itemId: String(line.itemId),
          variantId: line.variantId ? String(line.variantId) : undefined,
          optionIds: line.optionIds.map(String),
          quantity: line.quantity,
          note: line.note || undefined,
        });
        added += line.quantity;
      } catch (error) {
        skipped.push({
          name: line.name,
          reason:
            error instanceof Error ? error.message : 'Not available right now',
        });
      }
    }
    return { cart: await this.cart.view(userId), added, skipped };
  }

  private async own(
    userId: string,
    orderId: string,
    withChecksum = false,
  ): Promise<OrderRow> {
    if (!isValidObjectId(orderId))
      throw new NotFoundException('Order not found');
    const query = this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      userId: new Types.ObjectId(userId),
    });
    const order = await (
      withChecksum ? query.select('+checksum') : query
    ).lean<OrderRow>();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /* ───────────── helpers ───────────── */

  private enabledRules(): OrderingRules {
    const rules = this.ordering.rules();
    if (!rules.enabled || (!rules.delivery && !rules.pickup))
      throw new ForbiddenException('Online ordering is off right now');
    return rules;
  }

  private async hours(): Promise<OpeningHours | null> {
    const saved = await this.settings.publicOpeningHours();
    return saved.hours ?? this.ordering.settings().configHours;
  }

  private signingSecret(): string {
    const value: unknown = this.config.get('ORDER_SIGNING_SECRET', {
      infer: true,
    });
    const secret = typeof value === 'string' ? value.trim() : '';
    if (secret.length < 32) {
      this.logger.error(
        'ORDER_SIGNING_SECRET is missing or shorter than 32 characters',
      );
      throw new ServiceUnavailableException(
        'Ordering is not set up yet. Please call us to order.',
      );
    }
    return secret;
  }

  private async nextNumber(): Promise<string> {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { _id: 'orders' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      )
      .lean<Counter>();
    return String(FIRST_NUMBER + (counter?.seq ?? 1));
  }

  /**
   * Earlier unpaid online orders of this person are cancelled. A payment page that's still open
   * can't be cancelled: if the guest pays one later anyway, applyPayment refunds it.
   */
  private async abandonUnpaid(owner: Types.ObjectId): Promise<void> {
    const stale = await this.orderModel
      .find(
        { userId: owner, status: 'awaiting_payment' },
        { 'payment.chargeId': 1 },
      )
      .lean<OrderRow[]>();
    for (const order of stale) {
      if (order.payment.chargeId) {
        const payment = await this.gateway
          .check(order.payment.chargeId)
          .catch(() => null);
        if (payment?.status === 'paid') {
          // Paid after all (the callback hasn't arrived yet): keep it
          const full = await this.withChecksum(order._id);
          if (full) await this.applyPayment(full, payment);
          continue;
        }
      }
      await this.orderModel.updateOne(
        { _id: order._id, status: 'awaiting_payment' },
        {
          $set: { status: 'cancelled' },
          $push: {
            history: {
              status: 'cancelled',
              at: new Date(),
              note: 'Replaced by a new checkout',
            },
          },
        },
      );
    }
  }

  private format(minor: number, currency: string) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(fromMinor(minor) ?? 0);
    } catch {
      return `${fromMinor(minor)} ${currency}`;
    }
  }

  /** An order as the guest (and the receipt email) sees it */
  view(order: OrderRow, rules: OrderingRules): OrderView {
    const n = (minor: number | undefined) => fromMinor(minor ?? 0) ?? 0;
    return {
      id: String(order._id),
      number: order.number,
      status: order.status,
      type: order.type,
      currency: order.currency,
      createdAt: new Date(order.createdAt ?? Date.now()).toISOString(),
      payment: {
        method: shownMethod(order.payment.method),
        status: order.payment.status,
        cashChangeFor:
          order.payment.cashChangeFor === undefined
            ? undefined
            : n(order.payment.cashChangeFor),
        lastError: order.payment.lastError,
        paidAt: order.payment.paidAt?.toISOString(),
      },
      lines: order.lines.map((l) => ({
        name: l.name,
        image: l.image,
        variantName: l.variantName,
        options: l.options,
        quantity: l.quantity,
        unitPrice: n(l.unitPrice),
        unitWas: l.unitWas === undefined ? undefined : n(l.unitWas),
        total: n(l.total),
        note: l.note,
      })),
      amounts: {
        subtotal: n(order.amounts.subtotal),
        savings: n(order.amounts.savings),
        deliveryFee: n(order.amounts.deliveryFee),
        deliveryWaived: n(order.amounts.deliveryWaived),
        tip: n(order.amounts.tip),
        vat: n(order.amounts.vat),
        vatIncluded: order.amounts.vatIncluded,
        vatRate: order.amounts.vatRate,
        discount: n(order.amounts.discount),
        total: n(order.amounts.total),
      },
      customer: order.customer,
      address: order.address,
      pickupAddress:
        order.type === 'pickup' ? rules.pickup?.address : undefined,
      schedule: {
        asap: order.schedule.asap,
        for: order.schedule.for,
        from: new Date(order.schedule.from).toISOString(),
        to: new Date(order.schedule.to).toISOString(),
        timezone: order.schedule.timezone,
      },
      notes: order.notes,
      cutlery: order.cutlery,
      history: order.history.map((h) => ({
        status: h.status,
        at: new Date(h.at).toISOString(),
      })),
    };
  }
}

/* ───────────── signing ───────────── */

const pickAmounts = (q: Quote) => ({
  subtotal: q.subtotal,
  savings: q.savings,
  deliveryFee: q.deliveryFee,
  deliveryWaived: q.deliveryWaived,
  tip: q.tip,
  vat: q.vat,
  vatIncluded: q.vatIncluded,
  total: q.total,
});

type Signable = Pick<
  Order,
  'number' | 'userId' | 'currency' | 'amounts' | 'payment' | 'lines' | 'type'
> & { _id: Types.ObjectId };

/**
 * HMAC-SHA256 of what the guest pays and for what: order id, number, owner, type, currency,
 * total, payment method and every line. Stored on the order; an online payment is only accepted while it
 * still matches, and the payment must be for this order with the same amount and currency, so an amount
 * edited in the database (or a swapped payment) is caught.
 */
export function sign(secret: string, order: Signable): string {
  const facts = [
    String(order._id),
    order.number,
    String(order.userId),
    order.type,
    order.currency,
    order.amounts.total,
    order.payment.method,
    order.lines.map((l) => [
      String(l.itemId),
      l.variantId ? String(l.variantId) : '',
      l.optionIds.map(String),
      l.quantity,
      l.unitPrice,
      l.total,
    ]),
  ];
  return createHmac('sha256', secret)
    .update(JSON.stringify(facts))
    .digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === 32 && x.length === y.length && timingSafeEqual(x, y);
}
