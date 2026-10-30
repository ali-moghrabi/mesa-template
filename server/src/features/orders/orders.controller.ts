import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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

  /** POST /api/v1/orders → { order, paymentUrl? } (paymentUrl: the online payment page, when paying online) */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  place(@CurrentUser() me: CurrentActor, @Body() dto: PlaceOrderDto) {
    return this.orders.place(me.id, dto);
  }

  /** POST /api/v1/orders/:id/confirm-payment → the order, after reading the payment from the provider */
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
