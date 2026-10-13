import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { Authorize } from 'decorators/permission.decorator';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import { PlaceOrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';
import { StripeService } from './stripe.service';

/** The signed-in person's checkout and orders (any role). */
@Controller('orders')
@Authorize()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** GET /api/v1/orders/checkout → cart, order types, fees, slots, payments, prefill */
  @Get('checkout')
  checkout(@CurrentUser() me: CurrentActor) {
    return this.orders.checkout(me.id);
  }

  /** POST /api/v1/orders → { order, clientSecret? } (clientSecret for card orders) */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  place(@CurrentUser() me: CurrentActor, @Body() dto: PlaceOrderDto) {
    return this.orders.place(me.id, dto);
  }

  /** POST /api/v1/orders/:id/confirm-payment → the order, after reading the payment from Stripe */
  @Post(':id/confirm-payment')
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser() me: CurrentActor, @Param('id') id: string) {
    return this.orders.confirmPayment(me.id, id);
  }

  /** GET /api/v1/orders/mine?before=ISO → { active, past, nextBefore } */
  @Get('mine')
  mine(@CurrentUser() me: CurrentActor, @Query('before') before?: string) {
    return this.orders.mine(
      me.id,
      typeof before === 'string' ? before.slice(0, 40) : undefined,
    );
  }

  /** GET /api/v1/orders/active-count → { count }: orders still on their way (the account menu badge) */
  @Get('active-count')
  @SkipThrottle()
  activeCount(@CurrentUser() me: CurrentActor) {
    return this.orders.activeCount(me.id);
  }

  /** POST /api/v1/orders/:id/reorder → { cart, added, skipped }: the dishes back in the cart */
  @Post(':id/reorder')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  reorder(@CurrentUser() me: CurrentActor, @Param('id') id: string) {
    return this.orders.reorder(me.id, id);
  }

  /** GET /api/v1/orders/:id → one of the person's orders */
  @Get(':id')
  get(@CurrentUser() me: CurrentActor, @Param('id') id: string) {
    return this.orders.get(me.id, id);
  }
}

const INTENT_EVENTS = new Set<Stripe.Event['type']>([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.processing',
  'payment_intent.canceled',
]);

/**
 * POST /api/v1/payments/stripe/webhook. Called by Stripe, not by people: no sign-in, but every
 * call must carry Stripe's signature over the raw body (main.ts: NestFactory.create(AppModule, { rawBody: true })).
 */
@Controller('payments/stripe')
@SkipThrottle()
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly orders: OrdersService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!req.rawBody || !signature)
      throw new BadRequestException('Missing Stripe signature');

    let event: Stripe.Event;
    try {
      event = this.stripe.verifyWebhook(req.rawBody, signature);
    } catch (error) {
      this.logger.warn(`Rejected a webhook call: ${(error as Error).message}`);
      throw new BadRequestException('Invalid signature');
    }

    if (INTENT_EVENTS.has(event.type))
      await this.orders.handleIntentEvent(
        event.data.object as Stripe.PaymentIntent,
      );
    return { received: true };
  }
}
