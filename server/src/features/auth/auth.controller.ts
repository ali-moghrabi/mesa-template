import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService, type RequestMeta } from './auth.service';
import express from 'express';
import { JwtAuthGuard } from 'guards/jwt.guard';
import { User } from 'decorators/user.decorator';
import {
  CheckResetTokenDto,
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginUserDto,
  RegisterUserDto,
  ResetPasswordDto,
} from './dtos/auth.dtos';
import {
  PasswordResetService,
  RESET_TTL_MINUTES,
} from './password-reset.service';
import { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env';
import { Throttle } from '@nestjs/throttler';
import {
  ACCESS_TOKEN_NAME,
  ACCESS_TTL_SECONDS,
  REFRESH_TOKEN_NAME,
  REFRESH_TTL_SECONDS,
} from 'lib/constants/authConstants';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private passwordReset: PasswordResetService,
    private config: ConfigService<Env, true>,
  ) {}

  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() registerUserDto: RegisterUserDto) {
    await this.authService.registerNewUser(registerUserDto);

    return {
      message: 'User registered successfully',
    };
  }

  @Post('login')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(
      loginUserDto,
      this.meta(req),
    );

    this.setAccessCookie(res, accessToken);
    this.setRefreshCookie(res, refreshToken);

    return {
      message: 'User Logged successfully',
    };
  }

  /**
   * POST /api/v1/auth/google { code } → the same cookies as /login.
   * The code comes from Google's sign-in popup on the website. The X-Requested-With header is
   * required (Google's advice for popup codes): a plain cross-site form can't send it.
   */
  @Post('google')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async google(
    @Body() dto: GoogleLoginDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      throw new BadRequestException('Missing X-Requested-With header');
    }

    const { accessToken, refreshToken } =
      await this.authService.loginWithGoogle(dto.code, this.meta(req));

    this.setAccessCookie(res, accessToken);
    this.setRefreshCookie(res, refreshToken);

    return { message: 'Signed in with Google' };
  }

  /**
   * POST /api/v1/auth/forgot-password { email } → always the same answer, so nobody can find
   * out which emails have an account. The email (if any) goes out in the background.
   */
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: express.Request,
  ) {
    await this.passwordReset.request(dto.email, this.meta(req));
    return {
      message: `If an account uses this email, a reset link is on its way. It works for ${RESET_TTL_MINUTES} minutes.`,
    };
  }

  /** POST /api/v1/auth/reset-password/check { token } → { valid, email (masked), firstName } */
  @Post('reset-password/check')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  checkResetToken(@Body() dto: CheckResetTokenDto) {
    return this.passwordReset.check(dto.token);
  }

  /** POST /api/v1/auth/reset-password { token, password } → signs out every device */
  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordReset.reset(dto.token, dto.password);
    return {
      message: 'Your password is changed. Sign in with your new password.',
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    try {
      const tokens = await this.authService.refresh(
        this.refreshCookie(req),
        this.meta(req),
      );

      this.setAccessCookie(res, tokens.accessToken);
      if (tokens.refreshToken) this.setRefreshCookie(res, tokens.refreshToken);

      return { message: 'Session refreshed' };
    } catch (error) {
      if (error instanceof UnauthorizedException) this.clearAuthCookies(res);
      throw error;
    }
  }

  @Get('status')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  status(@User() user: IUser) {
    return user;
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    await this.authService.logout(this.refreshCookies(req));
    this.clearAuthCookies(res);
    this.clearLegacyCookies(res);

    return {
      message: 'User Logged out successfully',
    };
  }
  private cookieOptions(maxAgeSeconds?: number): express.CookieOptions {
    const domain = this.config.get('COOKIE_DOMAIN', { infer: true });
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/',
      ...(domain && { domain }),
      ...(maxAgeSeconds !== undefined && { maxAge: maxAgeSeconds * 1000 }),
    };
  }

  private setAccessCookie(res: express.Response, token: string) {
    res.cookie(
      ACCESS_TOKEN_NAME,
      token,
      this.cookieOptions(ACCESS_TTL_SECONDS),
    );
  }

  private setRefreshCookie(res: express.Response, token: string) {
    res.cookie(
      REFRESH_TOKEN_NAME,
      token,
      this.cookieOptions(REFRESH_TTL_SECONDS),
    );
  }

  private clearAuthCookies(res: express.Response) {
    res.clearCookie(ACCESS_TOKEN_NAME, this.cookieOptions());
    res.clearCookie(REFRESH_TOKEN_NAME, this.cookieOptions());
  }

  private clearLegacyCookies(res: express.Response) {
    const legacy = { ...this.cookieOptions(), path: '/api/v1/auth' };
    res.clearCookie(ACCESS_TOKEN_NAME, legacy);
    res.clearCookie(REFRESH_TOKEN_NAME, legacy);
  }

  private refreshCookies(req: express.Request): string[] {
    const header = req.headers.cookie ?? '';
    const values: string[] = [];
    for (const part of header.split(';')) {
      const eq = part.indexOf('=');
      if (eq < 0 || part.slice(0, eq).trim() !== REFRESH_TOKEN_NAME) continue;
      const raw = part.slice(eq + 1).trim();
      try {
        values.push(decodeURIComponent(raw));
      } catch {
        values.push(raw);
      }
    }
    return values.filter(Boolean);
  }

  private refreshCookie(req: express.Request): string | undefined {
    return this.refreshCookies(req).at(-1);
  }

  private meta(req: express.Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }
}
