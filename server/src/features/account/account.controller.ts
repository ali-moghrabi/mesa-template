import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Authorize } from 'decorators/permission.decorator';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import { AccountService } from './account.service';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  UpdateAccountDto,
} from './dto/account.dto';

/**
 * The signed-in person's own account (the website's /account page). Any role.
 * Everything acts on the user from the token, never on an id from the request.
 */
@Controller('account')
@Authorize()
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** GET /api/v1/account → the account */
  @Get()
  get(@CurrentUser() me: CurrentActor) {
    return this.account.get(me.id);
  }

  /** PATCH /api/v1/account { firstName, lastName, phone } → the account */
  @Patch()
  update(@CurrentUser() me: CurrentActor, @Body() dto: UpdateAccountDto) {
    return this.account.update(me.id, dto);
  }

  /** POST /api/v1/account/password { currentPassword, newPassword } · 400 wrong current password */
  @Post('password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(
    @CurrentUser() me: CurrentActor,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.account.changePassword(
      me.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /** POST /api/v1/account/sign-out-everywhere → every session ends, this one too */
  @Post('sign-out-everywhere')
  @HttpCode(HttpStatus.OK)
  signOutEverywhere(@CurrentUser() me: CurrentActor) {
    return this.account.signOutEverywhere(me.id);
  }

  /** POST /api/v1/account/delete { password } · 403 team accounts · 400 wrong password */
  @Post('delete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  remove(@CurrentUser() me: CurrentActor, @Body() dto: DeleteAccountDto) {
    return this.account.remove(me.id, dto.password);
  }
}
