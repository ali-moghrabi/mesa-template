import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Authorize } from 'decorators/permission.decorator';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import { SaveOpeningHoursDto } from './dto/opening-hours.dto';
import { SettingsService } from './settings.service';

/** Public: what the website needs. No sign-in. */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** GET /api/v1/settings/opening-hours → { hours } (null = not saved yet, use config.json) */
  @Get('opening-hours')
  openingHours() {
    return this.settings.publicOpeningHours();
  }
}

/** The admin settings page. settings:manage (admins). */
@Controller('admin/settings')
@Authorize('settings:manage')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** GET /api/v1/admin/settings/opening-hours → { hours, version, updatedAt, updatedBy } */
  @Get('opening-hours')
  openingHours() {
    return this.settings.adminOpeningHours();
  }

  /**
   * PATCH /api/v1/admin/settings/opening-hours { hours, version } → same as GET
   * 400 { errors: { "weekly.4.shifts.1.open": "…" } } · 409 someone saved in between
   */
  @Patch('opening-hours')
  saveOpeningHours(
    @Body() dto: SaveOpeningHoursDto,
    @CurrentUser() actor: CurrentActor,
  ) {
    return this.settings.saveOpeningHours(dto.hours, dto.version, actor);
  }
}
