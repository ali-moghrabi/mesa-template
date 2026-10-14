import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import { JwtAuthGuard } from 'guards/jwt.guard';
import {
  OVERVIEW_RANGES,
  OverviewService,
  type OverviewRange,
} from './overview.service';

/** GET /api/v1/admin/overview?range=7|30|90 (days of sales to compare; 7 by default) */
export class OverviewQuery {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsIn(OVERVIEW_RANGES)
  range?: OverviewRange;
}

/**
 * The admin panel's home page. Anyone on the team may call it; the service leaves out every
 * block the person isn't allowed to see (customers get 403).
 */
@Controller('admin/overview')
@UseGuards(JwtAuthGuard)
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  @SkipThrottle()
  get(@CurrentUser() me: CurrentActor, @Query() query: OverviewQuery) {
    return this.overview.overview(me, query.range ?? 7);
  }
}
