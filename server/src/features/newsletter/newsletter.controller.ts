import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import { JwtAuthGuard } from 'guards/jwt.guard';
import {
  SubscribeDto,
  TokenDto,
  TokenQuery,
  UnsubscribeDto,
} from './dto/newsletter.dto';
import { NewsletterService } from './newsletter.service';

import { clientIp } from 'lib/security/client-ip';

/**
 * The newsletter, public (no sign-in): the website's form and the links in the emails.
 *   POST /newsletter/subscribe     { email, source?, page? }      → { status: "pending" | "already" }
 *   GET  /newsletter/token         ?type=confirm|unsubscribe&token → { email (masked), status, expired }
 *   POST /newsletter/confirm       { token }
 *   POST /newsletter/unsubscribe   { token, reason? }
 *   POST /newsletter/resubscribe   { token }
 * Signed in (their account's email):
 *   GET  /newsletter/me                 → { status: "subscribed" | "pending" | "unsubscribed" | "none" }
 *   POST /newsletter/me/unsubscribe
 */
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  subscribe(@Body() dto: SubscribeDto, @Req() req: Request) {
    return this.newsletter.subscribe(dto, {
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('token')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  token(@Query() query: TokenQuery) {
    return this.newsletter.tokenInfo(query.type, query.token);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirm(@Body() dto: TokenDto) {
    return this.newsletter.confirm(dto.token);
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  unsubscribe(@Body() dto: UnsubscribeDto) {
    return this.newsletter.unsubscribe(dto.token, dto.reason);
  }

  @Post('resubscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resubscribe(@Body() dto: TokenDto) {
    return this.newsletter.resubscribe(dto.token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() me: CurrentActor) {
    return this.newsletter.myStatus(me.id);
  }

  @Post('me/unsubscribe')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  unsubscribeMe(@CurrentUser() me: CurrentActor) {
    return this.newsletter.unsubscribeMe(me.id);
  }
}
