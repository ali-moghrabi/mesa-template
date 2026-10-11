import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Authorize } from 'decorators/permission.decorator';
import { CurrentUser } from 'decorators/current-user.decorator';
import {
  ChangeRoleDto,
  ChangeStatusDto,
  ListTeamQuery,
  SearchCandidatesQuery,
} from './dto/team.dto';
import { TeamService, type Actor } from './team.service';

/**
 * The team page: who can open the admin panel, with which role.
 * users:manage (admins). The rank rules live in TeamService.
 */
@Controller('admin/team')
@Authorize('users:manage')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  /** GET /api/v1/admin/team?search=&role=&status=&page= → { items, meta, totals } */
  @Get()
  list(@Query() query: ListTeamQuery, @CurrentUser() actor: Actor) {
    return this.team.list(query, actor);
  }

  /** GET /api/v1/admin/team/candidates?search=sara → up to 8 customer accounts to add */
  @Get('candidates')
  candidates(@Query() query: SearchCandidatesQuery) {
    return this.team.candidates(query.search);
  }

  /**
   * PATCH /api/v1/admin/team/:id/role { role, from } → the member
   * 403 not allowed · 404 gone · 409 last admin, or changed by someone else meanwhile
   */
  @Patch(':id/role')
  changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.team.changeRole(id, dto.role, dto.from, actor);
  }

  /** PATCH /api/v1/admin/team/:id/status { isActive } → the member. Disabling signs them out everywhere. */
  @Patch(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.team.changeStatus(id, dto.isActive, actor);
  }
}
