import {
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
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Authorize } from 'decorators/permission.decorator';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import { PlaceOrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';
import { TapService, type TapCharge } from './tap.service';

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

  /** POST /api/v1/orders → { order, paymentUrl? } (paymentUrl: Tap's payment page, for card orders) */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  place(@CurrentUser() me: CurrentActor, @Body() dto: PlaceOrderDto) {
    return this.orders.place(me.id, dto);
  }

  /** POST /api/v1/orders/:id/confirm-payment → the order, after reading the payment from Tap */
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

/**
 * POST /api/v1/payments/tap/webhook. Called by Tap (post.url of each charge), not by people.
 * The body is only used for the charge id: OrdersService reads the charge again from Tap, so a
 * forged call can't mark anything paid. The "hashstring" signature is checked and logged as well.
 */
@Controller('payments/tap')
@SkipThrottle()
export class TapWebhookController {
  private readonly logger = new Logger(TapWebhookController.name);

  constructor(
    private readonly tap: TapService,
    private readonly orders: OrdersService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Body() body: TapCharge,
    @Headers('hashstring') hashstring?: string,
  ) {
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!this.tap.verifyWebhook(body, hashstring))
      this.logger.warn(
        `Tap webhook for ${id || 'nothing'}: the signature didn't check out. Reading it from Tap anyway.`,
      );

    // Charges only (refunds are recorded when they're made from the admin panel)
    if (/^chg_[A-Za-z0-9]+$/.test(id)) await this.orders.handleChargeEvent(id);
    return { received: true };
  }
}
