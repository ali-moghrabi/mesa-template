import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Authorize } from 'decorators/permission.decorator';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import { AccountService } from './account.service';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  DisableTwoFactorDto,
  StartTwoFactorDto,
  TwoFactorCodeDto,
  UpdateAccountDto,
  VerifyTokenDto,
} from './dto/account.dto';
import { EmailVerificationService } from './email-verification.service';
import { clientIp } from 'lib/security/client-ip';

@Controller('account')
@Authorize()
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly verification: EmailVerificationService,
  ) {}

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

  /**
   * POST /api/v1/account/verify-email → { status: "sent" | "cooldown" | "verified", sentTo, sentAt, resendAt }
   * Emails a verification link to the account's address. One a minute, five an hour.
   */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  sendVerification(@CurrentUser() me: CurrentActor, @Req() req: Request) {
    return this.verification.send(me.id, { ip: clientIp(req) });
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
      me.sessionId,
    );
  }

  /* ── Two-step sign-in (authenticator app). The state comes with GET /account. ── */

  /**
   * POST /api/v1/account/2fa/setup { code? } → { secret, uri, issuer, account }
   * Starts setup. When it's already on (moving to a new phone), a current code is required.
   */
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  startTwoFactor(
    @CurrentUser() me: CurrentActor,
    @Body() dto: StartTwoFactorDto,
  ) {
    return this.account.startTwoFactor(me.id, dto.code);
  }

  /** POST /api/v1/account/2fa/enable { code } → { recoveryCodes } (shown once) */
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  enableTwoFactor(
    @CurrentUser() me: CurrentActor,
    @Body() dto: TwoFactorCodeDto,
  ) {
    return this.account.enableTwoFactor(me.id, dto.code);
  }

  /** POST /api/v1/account/2fa/disable { code, password? } · 409 when the role requires it */
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  disableTwoFactor(
    @CurrentUser() me: CurrentActor,
    @Body() dto: DisableTwoFactorDto,
  ) {
    return this.account.disableTwoFactor(me.id, dto.code, dto.password);
  }

  /** POST /api/v1/account/2fa/recovery-codes { code } → { recoveryCodes } (the old ones stop working) */
  @Post('2fa/recovery-codes')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  newRecoveryCodes(
    @CurrentUser() me: CurrentActor,
    @Body() dto: TwoFactorCodeDto,
  ) {
    return this.account.newRecoveryCodes(me.id, dto.code);
  }

  /** POST /api/v1/account/2fa/forget-devices → every trusted browser asks for a code again */
  @Post('2fa/forget-devices')
  @HttpCode(HttpStatus.OK)
  forgetTrustedDevices(@CurrentUser() me: CurrentActor) {
    return this.account.forgetTrustedDevices(me.id);
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

/**
 * The link in the verification email (public: it may open on another device, signed out).
 *   GET  /api/v1/email-verification?token=…  → { email (masked), status: "pending" | "verified" }
 *   POST /api/v1/email-verification/confirm { token } → the same, now "verified"
 * 404 unknown link · 410 expired, or sent to an older address
 */
@Controller('email-verification')
export class EmailVerificationController {
  constructor(private readonly verification: EmailVerificationService) {}

  @Get()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  check(@Query() query: VerifyTokenDto) {
    return this.verification.check(query.token);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirm(@Body() dto: VerifyTokenDto) {
    return this.verification.confirm(dto.token);
  }
}
