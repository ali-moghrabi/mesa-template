import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Counter, CounterSchema } from 'src/schemas/order.schema';
import { Reservation, ReservationSchema } from 'src/schemas/reservation.schema';
import { User, UserSchema } from 'src/schemas/user.schema';
import { OrdersModule } from 'src/features/orders/orders.module';
import { SettingsModule } from 'src/features/settings/settings.module';
import { ReservationsAdminController } from './reservations-admin.controller';
import { ReservationsAdminService } from './reservations-admin.service';
import {
  ReservationsController,
  ReservationsPublicController,
} from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reservation.name, schema: ReservationSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: User.name, schema: UserSchema },
    ]),
    OrdersModule,
    SettingsModule,
  ],
  controllers: [
    ReservationsPublicController,
    ReservationsController,
    ReservationsAdminController,
  ],
  providers: [ReservationsService, ReservationsAdminService],
  exports: [ReservationsService, ReservationsAdminService],
})
export class ReservationsModule {}
