import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import type { Model, Types } from 'mongoose';
import {
  Subscriber,
  type SubscriberDocument,
  type SubscriberSource,
  type SubscriberStatus,
} from 'src/schemas/subscriber.schema';
import { User, type UserDocument } from 'src/schemas/user.schema';
import { MailService } from 'src/features/mail/mail.service';
import {
  newsletterConfirmEmail,
  newsletterWelcomeEmail,
} from 'src/features/mail/templates';
import { OrderingConfig } from 'src/features/orders/ordering.config';
import type { SubscribeDto, UnsubscribeReason } from './dto/newsletter.dto';
import { NewsletterSender } from './newsletter-sender.service';

export type SubscribeResult = { status: 'pending' | 'already' };

export type MyNewsletter = { status: SubscriberStatus | 'none' };

export type TokenInfo = {
  email: string;
  status: SubscriberStatus;
  expired: boolean;
};

export type Meta = { ip?: string; userAgent?: string };

const CONFIRM_TTL_MS = 7 * 24 * 60 * 60_000;
const RESEND_AFTER_MS = 2 * 60_000;

const newToken = () => randomBytes(32).toString('hex');
const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const maskEmail = (email: string) =>
  email.replace(/^(.)[^@]*(@.*)$/, '$1***$2');

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @InjectModel(Subscriber.name)
    private readonly subscriberModel: Model<SubscriberDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: OrderingConfig,
    private readonly mail: MailService,
    private readonly sender: NewsletterSender,
  ) {}

  async subscribe(
    dto: SubscribeDto,
    meta: Meta,
    options: { force?: boolean; source?: SubscriberSource } = {},
  ): Promise<SubscribeResult> {
    if (!options.force && !this.config.settings().newsletter.enabled)
      throw new ForbiddenException('The newsletter is closed right now.');
    if (dto.website) return { status: 'pending' };

    const email = dto.email.toLowerCase();
    const existing = await this.subscriberModel
      .findOne({ email })
      .lean<SubscriberRow>();
    if (existing?.status === 'subscribed') return { status: 'already' };

    if (
      !options.force &&
      existing?.status === 'pending' &&
      Date.now() - new Date(existing.consent.at).getTime() < RESEND_AFTER_MS
    )
      return { status: 'pending' };

    const token = newToken();
    const now = new Date();
    const consent = {
      at: now,
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300),
      page: dto.page,
    };
    const source = options.source ?? dto.source ?? 'website';
    const pending = {
      status: 'pending' as const,
      consent,
      confirmTokenHash: hash(token),
      confirmExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS),
    };

    if (existing) {
      await this.subscriberModel.updateOne(
        { email },
        {
          $set: { ...pending, source },
          $unset: { unsubscribedAt: 1, unsubscribeReason: 1 },
        },
      );
    } else {
      try {
        await this.subscriberModel.create({
          email,
          source,
          unsubscribeToken: newToken(),
          ...pending,
        });
      } catch (error) {
        if ((error as { code?: number }).code === 11000)
          return { status: 'pending' };
        throw error;
      }
    }

    const brand = this.mail.brand();
    this.mail
      .send(
        email,
        newsletterConfirmEmail(brand, {
          link: `${brand.webUrl}/newsletter?confirm=${token}`,
        }),
      )
      .catch((error: unknown) =>
        this.logger.error(
          `Newsletter confirmation email failed: ${(error as Error).message}`,
        ),
      );
    return { status: 'pending' };
  }

  async tokenInfo(
    type: 'confirm' | 'unsubscribe',
    token: string,
  ): Promise<TokenInfo> {
    const row = await this.byToken(type, token);
    return {
      email: maskEmail(row.email),
      status: row.status,
      expired:
        type === 'confirm' &&
        row.status === 'pending' &&
        (!row.confirmExpiresAt || row.confirmExpiresAt.getTime() < Date.now()),
    };
  }

  async confirm(token: string): Promise<TokenInfo> {
    const row = await this.byToken('confirm', token);
    if (row.status === 'subscribed')
      return {
        email: maskEmail(row.email),
        status: 'subscribed',
        expired: false,
      };
    if (
      row.status !== 'pending' ||
      !row.confirmExpiresAt ||
      row.confirmExpiresAt.getTime() < Date.now()
    ) {
      return { email: maskEmail(row.email), status: row.status, expired: true };
    }

    const updated = await this.subscriberModel
      .findOneAndUpdate(
        { _id: row._id, status: 'pending' },
        {
          $set: { status: 'subscribed', confirmedAt: new Date() },
          $unset: { confirmExpiresAt: 1 },
        },
        { returnDocument: 'after' },
      )
      .select('+unsubscribeToken')
      .lean<SubscriberRow>();
    if (!updated)
      return {
        email: maskEmail(row.email),
        status: 'subscribed',
        expired: false,
      };

    this.sendWelcome(updated);
    return {
      email: maskEmail(updated.email),
      status: 'subscribed',
      expired: false,
    };
  }

  async unsubscribe(
    token: string,
    reason?: UnsubscribeReason,
  ): Promise<TokenInfo> {
    const row = await this.byToken('unsubscribe', token);
    if (row.status !== 'unsubscribed') {
      await this.subscriberModel.updateOne(
        { _id: row._id },
        {
          $set: {
            status: 'unsubscribed',
            unsubscribedAt: new Date(),
            ...(reason && { unsubscribeReason: reason }),
          },
          $unset: { confirmTokenHash: 1, confirmExpiresAt: 1 },
        },
      );
    } else if (reason) {
      await this.subscriberModel.updateOne(
        { _id: row._id },
        { $set: { unsubscribeReason: reason } },
      );
    }
    return {
      email: maskEmail(row.email),
      status: 'unsubscribed',
      expired: false,
    };
  }

  async resubscribe(token: string): Promise<TokenInfo> {
    const row = await this.byToken('unsubscribe', token);
    if (row.status === 'unsubscribed' && row.confirmedAt) {
      await this.subscriberModel.updateOne(
        { _id: row._id },
        {
          $set: { status: 'subscribed' },
          $unset: { unsubscribedAt: 1, unsubscribeReason: 1 },
        },
      );
      return {
        email: maskEmail(row.email),
        status: 'subscribed',
        expired: false,
      };
    }
    return { email: maskEmail(row.email), status: row.status, expired: false };
  }

  async myStatus(userId: string): Promise<MyNewsletter> {
    const email = await this.emailOf(userId);
    const row = await this.subscriberModel
      .findOne({ email }, { status: 1 })
      .lean<{ status: SubscriberStatus }>();
    return { status: row?.status ?? 'none' };
  }

  async unsubscribeMe(userId: string): Promise<MyNewsletter> {
    const email = await this.emailOf(userId);
    await this.subscriberModel.updateOne(
      { email, status: { $ne: 'unsubscribed' } },
      {
        $set: { status: 'unsubscribed', unsubscribedAt: new Date() },
        $unset: { confirmTokenHash: 1, confirmExpiresAt: 1 },
      },
    );
    return {
      status: (await this.subscriberModel.exists({ email }))
        ? 'unsubscribed'
        : 'none',
    };
  }

  private async emailOf(userId: string): Promise<string> {
    const user = await this.userModel
      .findById(userId, { email: 1 })
      .lean<{ email: string }>();
    if (!user) throw new NotFoundException('Account not found');
    return user.email.toLowerCase();
  }

  private async byToken(
    type: 'confirm' | 'unsubscribe',
    token: string,
  ): Promise<SubscriberRow> {
    const filter =
      type === 'confirm'
        ? { confirmTokenHash: hash(token) }
        : { unsubscribeToken: token };
    const row = await this.subscriberModel
      .findOne(filter)
      .select('+unsubscribeToken')
      .lean<SubscriberRow>();
    if (!row)
      throw new NotFoundException(
        'This link is no longer valid. It may be old, or the address was removed.',
      );
    return row;
  }

  private sendWelcome(row: SubscriberRow) {
    const brand = this.mail.brand();
    const unsubscribe = `${brand.webUrl}/newsletter?unsubscribe=${row.unsubscribeToken}`;
    const oneClick = `${brand.webUrl}/newsletter/one-click?token=${row.unsubscribeToken}`;
    this.sender
      .settings()
      .then(({ welcome }) => {
        if (welcome.enabled === false) return;
        return this.mail.send(
          row.email,
          newsletterWelcomeEmail(brand, {
            unsubscribeLink: unsubscribe,
            message: welcome.message,
          }),
          {
            headers: {
              'List-Unsubscribe': `<${oneClick}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          },
        );
      })
      .catch((error: unknown) =>
        this.logger.error(
          `Newsletter welcome email failed: ${(error as Error).message}`,
        ),
      );
  }
}

type SubscriberRow = Subscriber & { _id: Types.ObjectId };
