import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import type { Model, Types } from 'mongoose';
import {
  EmailVerification,
  type EmailVerificationDocument,
} from 'src/schemas/email-verification.schema';
import { User, type UserDocument } from 'src/schemas/user.schema';
import { MailService } from 'src/features/mail/mail.service';
import { emailVerificationEmail } from 'src/features/mail/templates';

export const VERIFY_TTL_HOURS = 24;
const COOLDOWN_MS = 60_000;
const HOURLY_LIMIT = 5;
const HOUR_MS = 60 * 60_000;

const newToken = () => randomBytes(32).toString('hex');
const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const maskEmail = (email: string) =>
  email.replace(/^(.)[^@]*(@.*)$/, '$1***$2');

export type VerificationState = {
  status: 'sent' | 'cooldown' | 'verified';
  sentTo?: string;
  sentAt?: Date;
  resendAt?: Date;
};

export type VerifyLinkInfo = { email: string; status: 'pending' | 'verified' };

type UserRow = {
  _id: Types.ObjectId;
  firstName?: string;
  email: string;
  isEmailVerified?: boolean;
  isActive?: boolean;
};
type LinkRow = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectModel(EmailVerification.name)
    private readonly linkModel: Model<EmailVerificationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly mail: MailService,
  ) {}

  async send(
    userId: string | Types.ObjectId,
    meta: { ip?: string } = {},
  ): Promise<VerificationState> {
    const user = await this.user(userId);
    if (user.isEmailVerified) return { status: 'verified' };

    const wait = await this.cooldown(user._id);
    if (wait)
      return {
        status: 'cooldown',
        sentTo: maskEmail(user.email),
        sentAt: wait.sentAt,
        resendAt: wait.resendAt,
      };

    const token = newToken();
    const now = new Date();
    const email = user.email.toLowerCase();
    await this.linkModel.create({
      userId: user._id,
      email,
      tokenHash: hash(token),
      expiresAt: new Date(now.getTime() + VERIFY_TTL_HOURS * HOUR_MS),
      ...(meta.ip && { ip: meta.ip.slice(0, 64) }),
    });

    const brand = this.mail.brand();
    const link = `${brand.webUrl}/verify-email?token=${token}`;

    try {
      await this.mail.send(
        email,
        emailVerificationEmail(brand, {
          firstName: user.firstName ?? '',
          email,
          link,
          expiresInHours: VERIFY_TTL_HOURS,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Verification email failed: ${(error as Error).message}`,
      );
      await this.linkModel.deleteOne({ tokenHash: hash(token) });
      throw new BadRequestException(
        'We couldn’t send the email right now. Please try again in a few minutes.',
      );
    }

    return {
      status: 'sent',
      sentTo: maskEmail(email),
      sentAt: now,
      resendAt: (await this.cooldown(user._id))?.resendAt,
    };
  }

  async state(
    userId: string | Types.ObjectId,
  ): Promise<VerificationState | null> {
    const user = await this.user(userId);
    if (user.isEmailVerified) return null;
    const last = await this.linkModel
      .findOne(
        { userId: user._id, usedAt: null, expiresAt: { $gt: new Date() } },
        { createdAt: 1 },
      )
      .sort({ createdAt: -1 })
      .lean<{ createdAt: Date }>()
      .exec();
    if (!last) return null;
    const wait = await this.cooldown(user._id);
    return {
      status: 'sent',
      sentTo: maskEmail(user.email),
      sentAt: last.createdAt,
      resendAt: wait?.resendAt,
    };
  }

  async check(token: string): Promise<VerifyLinkInfo> {
    const { link, user } = await this.byToken(token);
    return {
      email: maskEmail(link.email),
      status: user.isEmailVerified || link.usedAt ? 'verified' : 'pending',
    };
  }

  async confirm(token: string): Promise<VerifyLinkInfo> {
    const { link, user } = await this.byToken(token);
    const email = maskEmail(link.email);
    if (user.isEmailVerified) {
      if (!link.usedAt)
        await this.linkModel.updateOne(
          { _id: link._id },
          { $set: { usedAt: new Date() } },
        );
      return { email, status: 'verified' };
    }

    const updated = await this.userModel.updateOne(
      { _id: user._id, email: link.email },
      { $set: { isEmailVerified: true, emailVerifiedAt: new Date() } },
    );
    if (updated.matchedCount === 0)
      throw new GoneException(
        'This link was for an older email address. Ask for a new one from your account page.',
      );

    await this.linkModel.updateOne(
      { _id: link._id },
      { $set: { usedAt: new Date() } },
    );
    this.logger.log(`Email verified for ${email}`);
    return { email, status: 'verified' };
  }

  private async user(userId: string | Types.ObjectId): Promise<UserRow> {
    const user = await this.userModel
      .findById(userId, {
        firstName: 1,
        email: 1,
        isEmailVerified: 1,
        isActive: 1,
      })
      .lean<UserRow>()
      .exec();
    if (!user || user.isActive === false)
      throw new NotFoundException('This account no longer exists');
    return user;
  }

  private async cooldown(
    userId: Types.ObjectId,
  ): Promise<{ sentAt: Date; resendAt: Date } | null> {
    const recent = await this.linkModel
      .find(
        { userId, createdAt: { $gt: new Date(Date.now() - HOUR_MS) } },
        { createdAt: 1 },
      )
      .sort({ createdAt: -1 })
      .lean<{ createdAt: Date }[]>()
      .exec();
    if (recent.length === 0) return null;

    const sentAt = recent[0].createdAt;
    const afterCooldown = sentAt.getTime() + COOLDOWN_MS;
    const afterLimit =
      recent.length >= HOURLY_LIMIT
        ? recent[HOURLY_LIMIT - 1].createdAt.getTime() + HOUR_MS
        : 0;
    const resendAt = Math.max(afterCooldown, afterLimit);
    return resendAt > Date.now()
      ? { sentAt, resendAt: new Date(resendAt) }
      : null;
  }

  private async byToken(
    token: string,
  ): Promise<{ link: LinkRow; user: UserRow }> {
    const link = await this.linkModel
      .findOne({ tokenHash: hash(token) })
      .lean<LinkRow>()
      .exec();
    if (!link)
      throw new NotFoundException(
        'This link isn’t valid anymore. It may be old or already replaced by a newer one.',
      );
    const user = await this.userModel
      .findById(link.userId, {
        firstName: 1,
        email: 1,
        isEmailVerified: 1,
        isActive: 1,
      })
      .lean<UserRow>()
      .exec();
    if (!user || user.isActive === false)
      throw new NotFoundException('This account no longer exists.');
    if (
      !link.usedAt &&
      !user.isEmailVerified &&
      link.expiresAt.getTime() < Date.now()
    )
      throw new GoneException(
        'This link has expired. Ask for a new one from your account page.',
      );
    if (!link.usedAt && link.email !== user.email.toLowerCase())
      throw new GoneException(
        'This link was for an older email address. Ask for a new one from your account page.',
      );
    return { link, user };
  }
}
