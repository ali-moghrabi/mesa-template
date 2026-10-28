import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import type { Model } from 'mongoose';
import {
  LoginAttempt,
  type LoginAttemptDocument,
} from 'src/schemas/login-attempt.schema';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;
const FIRST_LOCK_MS = 15 * 60_000;
const LONGEST_LOCK_MS = 60 * 60_000;
const KEEP_MS = 24 * 60 * 60_000;

type Row = {
  failures: number;
  windowStart: Date;
  lockedUntil: Date | null;
  locks: number;
};

@Injectable()
export class LoginAttemptsService {
  private readonly logger = new Logger(LoginAttemptsService.name);

  constructor(
    @InjectModel(LoginAttempt.name)
    private readonly model: Model<LoginAttemptDocument>,
  ) {}

  async assertNotLocked(identifier: string): Promise<void> {
    const row = await this.model
      .findOne({ key: keyOf(identifier) }, { lockedUntil: 1 })
      .lean<Pick<Row, 'lockedUntil'>>();
    const until = row?.lockedUntil?.getTime() ?? 0;
    if (until > Date.now()) throw lockedError(until);
  }

  async recordFailure(identifier: string): Promise<void> {
    const key = keyOf(identifier);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + KEEP_MS);
    const row = await this.model.findOne({ key }).lean<Row>();

    if (!row || now.getTime() - row.windowStart.getTime() > WINDOW_MS) {
      await this.model.updateOne(
        { key },
        {
          $set: { failures: 1, windowStart: now, lockedUntil: null, expiresAt },
          $setOnInsert: { locks: 0 },
        },
        { upsert: true },
      );
      return;
    }

    const updated = await this.model
      .findOneAndUpdate(
        { key },
        { $inc: { failures: 1 }, $set: { expiresAt } },
        { returnDocument: 'after' },
      )
      .lean<Row>();
    if (!updated || updated.failures < MAX_FAILURES) return;

    const lockMs = Math.min(
      FIRST_LOCK_MS * 2 ** (updated.locks ?? 0),
      LONGEST_LOCK_MS,
    );
    await this.model.updateOne(
      { key },
      {
        $set: {
          failures: 0,
          windowStart: now,
          lockedUntil: new Date(now.getTime() + lockMs),
        },
        $inc: { locks: 1 },
      },
    );
    this.logger.warn(
      `Sign-in locked for ${Math.round(lockMs / 60_000)} min after ${MAX_FAILURES} wrong passwords (key ${key.slice(0, 8)}…)`,
    );
  }

  async clear(...identifiers: (string | undefined)[]): Promise<void> {
    const keys = identifiers.filter((v): v is string => !!v).map(keyOf);
    if (keys.length) await this.model.deleteMany({ key: { $in: keys } });
  }
}

const keyOf = (identifier: string) =>
  createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex');

function lockedError(until: number) {
  const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60_000));
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
