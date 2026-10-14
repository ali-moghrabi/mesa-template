import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MenuItem, MenuItemSchema } from 'src/schemas/item.schema';
import { Message, MessageSchema } from 'src/schemas/message.schema';
import { Order, OrderSchema } from 'src/schemas/order.schema';
import { Reservation, ReservationSchema } from 'src/schemas/reservation.schema';
import { OrdersModule } from 'src/features/orders/orders.module';
import { ReservationsModule } from 'src/features/reservations/reservations.module';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Reservation.name, schema: ReservationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
    OrdersModule,
    ReservationsModule,
  ],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
