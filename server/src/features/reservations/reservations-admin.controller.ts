import {
  Body,
  Controller,
  Get,
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
import {
  CreateReservationAdminDto,
  DayQuery,
  ListReservationsQuery,
  ReservationNoteDto,
  ReservationStatusDto,
  UpdateReservationDto,
} from './dto/admin-reservation.dto';
import { ReservationsAdminService } from './reservations-admin.service';

/**
 * The admin panel's bookings.
 *   reservations:view   (staff, and everyone above): read everything
 *   reservations:manage (managers, owner): every change
 * Managers and the owner have both permissions.
 */
@Controller('admin/reservations')
@Authorize('reservations:view')
export class ReservationsAdminController {
  constructor(private readonly reservations: ReservationsAdminService) {}

  /** GET /api/v1/admin/reservations/day?date=2026-10-18 → the day's bookings, totals, the week around it */
  @Get('day')
  @SkipThrottle() // refreshed every minute by every open screen
  day(@Query() query: DayQuery) {
    return this.reservations.day(query.date);
  }

  /** GET /api/v1/admin/reservations/requests → requests waiting for an answer */
  @Get('requests')
  @SkipThrottle()
  requests() {
    return this.reservations.requests();
  }

  /** GET /api/v1/admin/reservations/pending-count → { count } (the sidebar badge) */
  @Get('pending-count')
  @SkipThrottle()
  pendingCount() {
    return this.reservations.pendingCount();
  }

  /** GET /api/v1/admin/reservations?q&status&from&to&page → search */
  @Get()
  list(@Query() query: ListReservationsQuery) {
    return this.reservations.list(query);
  }

  /** GET /api/v1/admin/reservations/:id → one booking, with the guest's history */
  @Get(':id')
  get(@Param('id') id: string) {
    return this.reservations.get(id);
  }

  /** POST /api/v1/admin/reservations → a phone booking or a walk-in */
  @Post()
  @RequirePermissions('reservations:manage')
  create(
    @CurrentUser() me: CurrentActor,
    @Body() dto: CreateReservationAdminDto,
  ) {
    return this.reservations.create(me, dto);
  }

  /** PATCH /api/v1/admin/reservations/:id/status { status, version, reason?, notify? } */
  @Patch(':id/status')
  @RequirePermissions('reservations:manage')
  changeStatus(
    @CurrentUser() me: CurrentActor,
    @Param('id') id: string,
    @Body() dto: ReservationStatusDto,
  ) {
    return this.reservations.changeStatus(me, id, dto);
  }

  /** PATCH /api/v1/admin/reservations/:id/note { note }: the team's private note */
  @Patch(':id/note')
  @RequirePermissions('reservations:manage')
  note(@Param('id') id: string, @Body() dto: ReservationNoteDto) {
    return this.reservations.setNote(id, dto.note);
  }

  /** PATCH /api/v1/admin/reservations/:id { version, date, time, partySize, name, phone, email, occasion, notes, table, notify? } */
  @Patch(':id')
  @RequirePermissions('reservations:manage')
  update(
    @CurrentUser() me: CurrentActor,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservations.update(me, id, dto);
  }
}
