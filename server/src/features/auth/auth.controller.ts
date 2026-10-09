import {
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
import { LoginUserDto, RegisterUserDto } from './dtos/auth.dtos';
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
