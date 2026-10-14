import {
  Controller,
  Get,
  HttpStatus,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import mongoose, { type Connection } from 'mongoose';

const STARTED_AT = Date.now();
const PING_TIMEOUT_MS = 2_000;
@Controller({ path: 'health', version: VERSION_NEUTRAL })
@SkipThrottle()
export class AppController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  async health(@Res({ passthrough: true }) res: Response) {
    const db = await this.pingDatabase();
    res.setHeader('Cache-Control', 'no-store');
    if (!db) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: db ? 'ok' : 'degraded',
      db: db ? 'up' : 'down',
      uptime: Math.round((Date.now() - STARTED_AT) / 1000),
    };
  }

  private async pingDatabase(): Promise<boolean> {
    const db = this.connection.db;
    if (
      this.connection.readyState !== mongoose.ConnectionStates.connected ||
      !db
    )
      return false;

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        db.admin().ping(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('timeout')),
            PING_TIMEOUT_MS,
          );
        }),
      ]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
