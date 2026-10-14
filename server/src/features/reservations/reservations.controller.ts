import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Authorize } from 'decorators/permission.decorator';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import {
  CancelReservationDto,
  CreateReservationDto,
} from './dto/reservation.dto';
import { ReservationsService } from './reservations.service';

/**
 * GET /api/v1/reservations/availability → { timezone, today, days, rules }
 * Public: anyone can look at free times; booking needs an account (below).
 * Registered before ReservationsController in the module, so "availability" never reads as an :id.
 */
@Controller('reservations')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class ReservationsPublicController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get('availability')
  availability() {
    return this.reservations.availability();
  }
}

/** The signed-in person's table bookings (any role). */
@Controller('reservations')
@Authorize()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  /** POST /api/v1/reservations → the booking request ("pending") */
  @Post()
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  create(@CurrentUser() me: CurrentActor, @Body() dto: CreateReservationDto) {
    return this.reservations.create(me.id, dto);
  }

  /** GET /api/v1/reservations/mine → { upcoming, past } */
  @Get('mine')
  mine(@CurrentUser() me: CurrentActor) {
    return this.reservations.mine(me.id);
  }

  /** GET /api/v1/reservations/:id → one of the person's bookings */
  @Get(':id')
  get(@CurrentUser() me: CurrentActor, @Param('id') id: string) {
    return this.reservations.get(me.id, id);
  }

  /** POST /api/v1/reservations/:id/cancel { reason? } → the cancelled booking */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  cancel(
    @CurrentUser() me: CurrentActor,
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservations.cancel(me.id, id, dto);
  }
}
