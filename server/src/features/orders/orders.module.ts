import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cart, CartSchema } from 'src/schemas/cart.schema';
import {
  Counter,
  CounterSchema,
  Order,
  OrderSchema,
} from 'src/schemas/order.schema';
import { MenuItem, MenuItemSchema } from 'src/schemas/item.schema';
import { User, UserSchema } from 'src/schemas/user.schema';
import { CartModule } from 'src/features/cart/cart.module';
import { SettingsModule } from 'src/features/settings/settings.module';
import { PromotionsModule } from 'src/features/promotions/promotions.module';
import { OrderingConfig } from './ordering.config';
import { OrdersAdminController } from './orders-admin.controller';
import { OrdersAdminService } from './orders-admin.service';
import { OrdersController, StripeWebhookController } from './orders.controller';
import { OrdersService } from './orders.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: Cart.name, schema: CartSchema },
      { name: User.name, schema: UserSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
    CartModule,
    SettingsModule,
    PromotionsModule,
  ],
  controllers: [
    OrdersController,
    StripeWebhookController,
    OrdersAdminController,
  ],
  providers: [OrdersService, OrdersAdminService, OrderingConfig, StripeService],
  exports: [OrdersService, OrderingConfig],
})
export class OrdersModule {}
