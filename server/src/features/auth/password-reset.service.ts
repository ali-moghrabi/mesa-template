import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { User, UserDocument } from 'src/schemas/user.schema';
import { Session, SessionDocument } from 'src/schemas/session.schema';
import {
  PasswordReset,
  PasswordResetDocument,
} from 'src/schemas/password-reset.schema';
import { MailService } from 'src/features/mail/mail.service';
import { passwordResetEmail } from 'src/features/mail/templates';
import type { RequestMeta } from './auth.service';
import { passwordProblem } from 'lib/security/password-policy';
import { LoginAttemptsService } from './login-attempts.service';
import { TwoFactorService } from 'src/features/two-factor/two-factor.service';

export const RESET_TTL_MINUTES = 30;
const RESEND_COOLDOWN_MS = 60_000;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***${local.length > 2 ? local.slice(-1) : ''}@${domain}`;
};

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(PasswordReset.name)
    private resetModel: Model<PasswordResetDocument>,
    private readonly mail: MailService,
    private readonly loginAttempts: LoginAttemptsService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async request(rawEmail: string, meta: RequestMeta): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.userModel
      .findOne({ email }, { firstName: 1, email: 1, isActive: 1 })
      .lean<{
        _id: Types.ObjectId;
        firstName: string;
        email: string;
        isActive: boolean;
      }>();
    if (!user || user.isActive === false) return;

    const recent = await this.resetModel.exists({
      userId: user._id,
      createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    });
    if (recent) return;

    await this.resetModel.deleteMany({ userId: user._id });
    const token = randomBytes(32).toString('base64url');
    await this.resetModel.create({
      userId: user._id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
      ip: meta.ip?.slice(0, 64),
    });

    const b = this.mail.brand();
    const content = passwordResetEmail(b, {
      firstName: user.firstName,
      link: `${b.webUrl}/reset-password/verify?token=${token}`,
      expiresInMinutes: RESET_TTL_MINUTES,
      requestedAt: requestedAt(b.timezone),
    });

    void this.mail
      .send(user.email, content)
      .catch((error: unknown) =>
        this.logger.error(`Password reset email failed: ${String(error)}`),
      );
  }

  async check(
    token: string,
  ): Promise<
    { valid: true; email: string; firstName: string } | { valid: false }
  > {
    const reset = await this.findUsable(token);
    if (!reset) return { valid: false };
    const user = await this.userModel
      .findById(reset.userId, { email: 1, firstName: 1, isActive: 1 })
      .lean<{ email: string; firstName: string; isActive: boolean }>();
    if (!user || user.isActive === false) return { valid: false };
    return {
      valid: true,
      email: maskEmail(user.email),
      firstName: user.firstName,
    };
  }

  async reset(token: string, password: string): Promise<void> {
    const pending = await this.findUsable(token);
    if (pending) {
      const owner = await this.userModel
        .findById(pending.userId, {
          email: 1,
          username: 1,
          firstName: 1,
          lastName: 1,
        })
        .lean<{
          email: string;
          username: string;
          firstName: string;
          lastName: string;
        }>();
      const weak = owner && (await passwordProblem(password, owner));
      if (weak) throw new BadRequestException(weak);
    }

    const reset = await this.resetModel.findOneAndUpdate(
      {
        tokenHash: sha256(token),
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { usedAt: new Date() } },
    );
    if (!reset)
      throw new BadRequestException(
        'This reset link has expired or was already used. Ask for a new one.',
      );

    const user = await this.userModel
      .findById(reset.userId, { isActive: 1, email: 1, username: 1 })
      .lean<{
        _id: Types.ObjectId;
        isActive: boolean;
        email: string;
        username: string;
      }>();
    if (!user || user.isActive === false)
      throw new BadRequestException(
        'This reset link has expired or was already used. Ask for a new one.',
      );

    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: {
          password: await bcrypt.hash(password, 12),
          isEmailVerified: true,
        },
        $inc: { tokenVersion: 1 },
      },
    );
    await Promise.all([
      this.sessionModel.deleteMany({ userId: user._id }),
      this.resetModel.deleteMany({ userId: user._id }),
      this.loginAttempts.clear(user.email, user.username),
      this.twoFactor.forgetDevices(user._id),
    ]);
    this.logger.log(`Password reset for user ${String(user._id)}`);
  }

  private findUsable(token: string) {
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return Promise.resolve(null);
    return this.resetModel
      .findOne({
        tokenHash: sha256(token),
        usedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .lean<PasswordReset>();
  }
}

function requestedAt(timeZone: string) {
  try {
    return `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date())} (${timeZone})`;
  } catch {
    return new Date().toISOString().replace('T', ' ').slice(0, 16) + ' (UTC)';
  }
}
