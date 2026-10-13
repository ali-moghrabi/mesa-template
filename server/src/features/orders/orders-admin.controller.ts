import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Authorize, RequirePermissions } from 'decorators/permission.decorator';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import { hasPermission } from 'lib/constants/roles';
import {
  ChangeStatusDto,
  EditOrderDto,
  ListOrdersQuery,
  RefundDto,
  StaffNoteDto,
} from './dto/admin-order.dto';
import { OrdersAdminService } from './orders-admin.service';

/**
 * The admin panel's orders.
 *   orders:manage (staff, managers, owner): the board, history, moving orders along, team notes
 *   orders:edit   (owner): changing dishes and prices, refunds, cancelling paid orders
 */
@Controller('admin/orders')
@Authorize('orders:manage')
export class OrdersAdminController {
  constructor(private readonly orders: OrdersAdminService) {}

  /** GET /api/v1/admin/orders/board → orders in progress + finished in the last 12 hours */
  @Get('board')
  @SkipThrottle() // polled every few seconds by every open screen
  board() {
    return this.orders.board();
  }

  /** GET /api/v1/admin/orders/feed?after=ISO → new orders since then (for the alert) */
  @Get('feed')
  @SkipThrottle()
  feed(@Query('after') after?: string) {
    return this.orders.feed(
      typeof after === 'string' ? after.slice(0, 40) : undefined,
    );
  }

  /** GET /api/v1/admin/orders?status&type&q&from&to&page → history */
  @Get()
  list(@Query() query: ListOrdersQuery) {
    return this.orders.list(query);
  }

  /** GET /api/v1/admin/orders/:id → the full order */
  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.get(id);
  }

  /** PATCH /api/v1/admin/orders/:id/status { status, version, reason?, refund? } */
  @Patch(':id/status')
  changeStatus(
    @CurrentUser() me: CurrentActor,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.orders.changeStatus(
      me,
      id,
      dto,
      hasPermission(me.role, 'orders:edit'),
    );
  }

  /** PATCH /api/v1/admin/orders/:id/note { note }: the team's private note */
  @Patch(':id/note')
  note(@Param('id') id: string, @Body() dto: StaffNoteDto) {
    return this.orders.setStaffNote(id, dto.note);
  }

  /** PATCH /api/v1/admin/orders/:id/items { version, lines, deliveryFee?, discount?, reason } (owner) */
  @Patch(':id/items')
  @RequirePermissions('orders:edit')
  edit(
    @CurrentUser() me: CurrentActor,
    @Param('id') id: string,
    @Body() dto: EditOrderDto,
  ) {
    return this.orders.editItems(me, id, dto);
  }

  /** POST /api/v1/admin/orders/:id/refund { amount, reason } (owner) */
  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('orders:edit')
  refund(
    @CurrentUser() me: CurrentActor,
    @Param('id') id: string,
    @Body() dto: RefundDto,
  ) {
    return this.orders.refund(me, id, dto);
  }
}
