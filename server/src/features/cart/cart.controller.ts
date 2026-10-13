import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Authorize } from 'decorators/permission.decorator';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import { CartService } from './cart.service';
import { AddCartLineDto, UpdateCartLineDto } from './dto/cart.dto';

/**
 * The signed-in person's cart. Any role; guests without an account get 401.
 * Every route answers with the whole cart, priced now, so the website never adds up prices itself.
 */
@Controller('cart')
@Authorize()
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class CartController {
  constructor(private readonly cart: CartService) {}

  /** GET /api/v1/cart → { lines, count, subtotal, savings, ready, updatedAt } */
  @Get()
  get(@CurrentUser() me: CurrentActor) {
    return this.cart.view(me.id);
  }

  /** POST /api/v1/cart/lines { itemId, variantId?, optionIds?, quantity, note? } → the cart */
  @Post('lines')
  @HttpCode(HttpStatus.OK)
  add(@CurrentUser() me: CurrentActor, @Body() dto: AddCartLineDto) {
    return this.cart.add(me.id, dto);
  }

  /** PATCH /api/v1/cart/lines/:lineId { quantity } → the cart (0 removes) */
  @Patch('lines/:lineId')
  setQuantity(
    @CurrentUser() me: CurrentActor,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateCartLineDto,
  ) {
    return this.cart.setQuantity(me.id, lineId, dto.quantity);
  }

  /** DELETE /api/v1/cart/lines/:lineId → the cart */
  @Delete('lines/:lineId')
  remove(@CurrentUser() me: CurrentActor, @Param('lineId') lineId: string) {
    return this.cart.remove(me.id, lineId);
  }

  /** DELETE /api/v1/cart → the empty cart */
  @Delete()
  clear(@CurrentUser() me: CurrentActor) {
    return this.cart.clear(me.id);
  }
}
