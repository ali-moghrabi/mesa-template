import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { isValidObjectId, Types, type QueryFilter, type Model } from 'mongoose';
import type { CurrentActor } from 'decorators/current-user.decorator';
import { escapeRegex } from 'lib/pagination';
import { windowsLabel } from 'lib/promotions';
import {
  Campaign,
  NewsletterSettings,
  type CampaignDocument,
  type CampaignKind,
  type CampaignStatus,
  type NewsletterSettingsDocument,
} from 'src/schemas/campaign.schema';
import { MenuItem, type MenuItemDocument } from 'src/schemas/item.schema';
import {
  Subscriber,
  type SubscriberDocument,
  type SubscriberSource,
  type SubscriberStatus,
} from 'src/schemas/subscriber.schema';
import { User, type UserDocument } from 'src/schemas/user.schema';
import { OrderingConfig } from 'src/features/orders/ordering.config';
import type {
  AddSubscriberDto,
  AutomationsDto,
  ListCampaignsQuery,
  ListSubscribersQuery,
  SaveCampaignDto,
  SendCampaignDto,
} from './dto/newsletter-admin.dto';
import {
  NewsletterSender,
  type CampaignContent,
} from './newsletter-sender.service';
import { NewsletterService } from './newsletter.service';

export type AdminSubscriber = {
  id: string;
  email: string;
  status: SubscriberStatus;
  source: SubscriberSource;
  createdAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  unsubscribeReason: string | null;
};

export type SubscriberCounts = {
  all: number;
  subscribed: number;
  pending: number;
  unsubscribed: number;
};
export type SubscribersPage = {
  items: AdminSubscriber[];
  total: number;
  page: number;
  pages: number;
  counts: SubscriberCounts;
};

export type NewsletterStats = {
  counts: SubscriberCounts;
  daily: { date: string; joined: number; left: number }[];
  joined30: number;
  left30: number;
  sources: { source: SubscriberSource; count: number }[];
  reasons: { reason: string; count: number }[];
  lastCampaign: {
    id: string;
    subject: string;
    sentAt: string;
    sent: number;
  } | null;
  toReview: number;
};

export type CampaignSummary = {
  id: string;
  kind: CampaignKind;
  status: CampaignStatus;
  subject: string;
  preheader: string;
  needsReview: boolean;
  scheduledAt: string | null;
  startedAt: string | null;
  sentAt: string | null;
  stats: { recipients: number; sent: number; failed: number };
  createdBy: string | null;
  sentBy: string | null;
  updatedAt: string;
};

export type AdminCampaign = CampaignSummary & {
  heading: string;
  body: string;
  button: { label: string; url: string } | null;
  dishIds: string[];
  lastError: string | null;
  version: string;
};

export type CampaignsPage = {
  items: CampaignSummary[];
  total: number;
  page: number;
  pages: number;
  counts: Record<
    'all' | 'draft' | 'scheduled' | 'sending' | 'sent' | 'review',
    number
  >;
};

export type AutomationsView = {
  welcome: { enabled: boolean; message: string };
  sale: {
    enabled: boolean;
    mode: 'auto' | 'review';
    minPercent: number;
    cooldownDays: number;
    intro: string;
    lastSentAt: string | null;
  };
  pending: { id: string; name: string; percentOff: number; hours: string }[];
  nextAllowedAt: string | null;
  recent: CampaignSummary[];
};

export type DishOption = {
  id: string;
  name: string;
  image?: string;
  category: string;
};

type SubscriberRow = Subscriber & { _id: Types.ObjectId };
type CampaignRow = Campaign & { _id: Types.ObjectId };

const SUBSCRIBERS_PAGE = 25;
const CAMPAIGNS_PAGE = 20;
const DAY_MS = 24 * 60 * 60_000;
const EDITABLE: CampaignStatus[] = ['draft', 'scheduled'];
const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : null);
const versionOf = (c: { updatedAt?: Date }) =>
  new Date(c.updatedAt ?? 0).toISOString();
const changedMeanwhile = () =>
  new ConflictException(
    'Someone else changed this newsletter a moment ago. It has been refreshed: check it and try again.',
  );

@Injectable()
export class NewsletterAdminService {
  constructor(
    @InjectModel(Subscriber.name)
    private readonly subscriberModel: Model<SubscriberDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(NewsletterSettings.name)
    private readonly settingsModel: Model<NewsletterSettingsDocument>,
    @InjectModel(MenuItem.name)
    private readonly itemModel: Model<MenuItemDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly sender: NewsletterSender,
    private readonly newsletter: NewsletterService,
    private readonly config: OrderingConfig,
  ) {}

  async stats(): Promise<NewsletterStats> {
    const timezone = this.config.rules().timezone;
    const since = new Date(Date.now() - 30 * DAY_MS);
    const day = (field: string) => ({
      $dateToString: { format: '%Y-%m-%d', date: field, timezone },
    });

    const [counts, joined, left, sources, reasons, last, toReview] =
      await Promise.all([
        this.counts(),
        this.subscriberModel.aggregate<{ _id: string; n: number }>([
          { $match: { confirmedAt: { $gte: since } } },
          { $group: { _id: day('$confirmedAt'), n: { $sum: 1 } } },
        ]),
        this.subscriberModel.aggregate<{ _id: string; n: number }>([
          { $match: { unsubscribedAt: { $gte: since } } },
          { $group: { _id: day('$unsubscribedAt'), n: { $sum: 1 } } },
        ]),
        this.subscriberModel.aggregate<{
          _id: SubscriberSource;
          count: number;
        }>([
          { $match: { status: 'subscribed' } },
          { $group: { _id: '$source', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        this.subscriberModel.aggregate<{ _id: string; count: number }>([
          {
            $match: {
              status: 'unsubscribed',
              unsubscribedAt: { $gte: new Date(Date.now() - 90 * DAY_MS) },
            },
          },
          {
            $group: {
              _id: { $ifNull: ['$unsubscribeReason', 'none'] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]),
        this.campaignModel
          .findOne({ status: 'sent' }, { subject: 1, sentAt: 1, stats: 1 })
          .sort({ sentAt: -1 })
          .lean<CampaignRow>(),
        this.campaignModel.countDocuments({
          status: 'draft',
          needsReview: true,
        }),
      ]);

    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const daily = Array.from({ length: 30 }, (_, i) => {
      const date = fmt.format(new Date(Date.now() - (29 - i) * DAY_MS));
      return {
        date,
        joined: joined.find((j) => j._id === date)?.n ?? 0,
        left: left.find((l) => l._id === date)?.n ?? 0,
      };
    });

    return {
      counts,
      daily,
      joined30: daily.reduce((s, d) => s + d.joined, 0),
      left30: daily.reduce((s, d) => s + d.left, 0),
      sources: sources.map((s) => ({ source: s._id, count: s.count })),
      reasons: reasons.map((r) => ({ reason: r._id, count: r.count })),
      lastCampaign: last
        ? {
            id: String(last._id),
            subject: last.subject,
            sentAt: iso(last.sentAt)!,
            sent: last.stats?.sent ?? 0,
          }
        : null,
      toReview,
    };
  }

  private async counts(): Promise<SubscriberCounts> {
    const rows = await this.subscriberModel.aggregate<{
      _id: SubscriberStatus;
      n: number;
    }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    const of = (s: SubscriberStatus) => rows.find((r) => r._id === s)?.n ?? 0;
    return {
      all: rows.reduce((s, r) => s + r.n, 0),
      subscribed: of('subscribed'),
      pending: of('pending'),
      unsubscribed: of('unsubscribed'),
    };
  }

  async subscribers(query: ListSubscribersQuery): Promise<SubscribersPage> {
    const filter: QueryFilter<SubscriberDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.source) filter.source = query.source;
    if (query.q)
      filter.email = new RegExp(escapeRegex(query.q.toLowerCase()), 'i');
    const page = query.page ?? 1;
    const [rows, total, counts] = await Promise.all([
      this.subscriberModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * SUBSCRIBERS_PAGE)
        .limit(SUBSCRIBERS_PAGE)
        .lean<SubscriberRow[]>(),
      this.subscriberModel.countDocuments(filter),
      this.counts(),
    ]);
    return {
      items: rows.map(toSubscriber),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / SUBSCRIBERS_PAGE)),
      counts,
    };
  }

  async exportSubscribers(
    status?: SubscriberStatus,
  ): Promise<AdminSubscriber[]> {
    const rows = await this.subscriberModel
      .find(status ? { status } : {})
      .sort({ createdAt: 1 })
      .limit(100_000)
      .lean<SubscriberRow[]>();
    return rows.map(toSubscriber);
  }

  async addSubscriber(dto: AddSubscriberDto): Promise<AdminSubscriber> {
    const email = dto.email.toLowerCase();
    const existing = await this.subscriberModel
      .findOne({ email })
      .lean<SubscriberRow>();
    if (existing?.status === 'subscribed')
      throw new ConflictException(`${email} is already on the list.`);

    if (dto.consent === 'confirm') {
      await this.newsletter.subscribe(
        { email },
        {},
        { force: true, source: 'admin' },
      );
    } else {
      const now = new Date();
      await this.subscriberModel.updateOne(
        { email },
        {
          $set: {
            status: 'subscribed',
            confirmedAt: now,
            consent: {
              at: now,
              page: 'Added in the admin panel (consent given)',
            },
          },
          $setOnInsert: {
            email,
            source: 'admin',
            unsubscribeToken: randomBytes(32).toString('hex'),
          },
          $unset: {
            unsubscribedAt: 1,
            unsubscribeReason: 1,
            confirmTokenHash: 1,
            confirmExpiresAt: 1,
          },
        },
        { upsert: true },
      );
    }
    return toSubscriber(
      (await this.subscriberModel.findOne({ email }).lean<SubscriberRow>())!,
    );
  }

  async resendConfirmation(id: string): Promise<AdminSubscriber> {
    const row = await this.subscriber(id);
    if (row.status !== 'pending')
      throw new BadRequestException(
        'Only people who haven’t confirmed yet can get the confirmation again.',
      );
    await this.newsletter.subscribe(
      { email: row.email },
      {},
      { force: true, source: row.source },
    );
    return toSubscriber(
      (await this.subscriberModel.findById(id).lean<SubscriberRow>())!,
    );
  }

  async unsubscribe(id: string): Promise<AdminSubscriber> {
    const row = await this.subscriber(id);
    if (row.status !== 'unsubscribed') {
      await this.subscriberModel.updateOne(
        { _id: row._id },
        {
          $set: {
            status: 'unsubscribed',
            unsubscribedAt: new Date(),
            unsubscribeReason: 'removed_by_team',
          },
          $unset: { confirmTokenHash: 1, confirmExpiresAt: 1 },
        },
      );
    }
    return toSubscriber(
      (await this.subscriberModel.findById(id).lean<SubscriberRow>())!,
    );
  }

  async deleteSubscriber(id: string): Promise<{ deleted: true }> {
    const row = await this.subscriber(id);
    await this.subscriberModel.deleteOne({ _id: row._id });
    return { deleted: true };
  }

  private async subscriber(id: string): Promise<SubscriberRow> {
    if (!isValidObjectId(id))
      throw new NotFoundException('Subscriber not found');
    const row = await this.subscriberModel.findById(id).lean<SubscriberRow>();
    if (!row) throw new NotFoundException('Subscriber not found');
    return row;
  }

  async campaigns(query: ListCampaignsQuery): Promise<CampaignsPage> {
    const filter: QueryFilter<CampaignDocument> =
      query.status === 'review'
        ? { status: 'draft', needsReview: true }
        : query.status
          ? { status: query.status }
          : {};
    const page = query.page ?? 1;
    const [rows, total, grouped, review] = await Promise.all([
      this.campaignModel
        .find(filter, { body: 0 })
        .sort({ updatedAt: -1 })
        .skip((page - 1) * CAMPAIGNS_PAGE)
        .limit(CAMPAIGNS_PAGE)
        .lean<CampaignRow[]>(),
      this.campaignModel.countDocuments(filter),
      this.campaignModel.aggregate<{ _id: CampaignStatus; n: number }>([
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]),
      this.campaignModel.countDocuments({ status: 'draft', needsReview: true }),
    ]);
    const of = (s: CampaignStatus) => grouped.find((g) => g._id === s)?.n ?? 0;
    return {
      items: rows.map(toSummary),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / CAMPAIGNS_PAGE)),
      counts: {
        all: grouped.reduce((s, g) => s + g.n, 0),
        draft: of('draft'),
        scheduled: of('scheduled'),
        sending: of('sending') + of('paused'),
        sent: of('sent'),
        review,
      },
    };
  }

  async campaign(id: string): Promise<AdminCampaign> {
    return toCampaign(await this.findCampaign(id));
  }

  async createCampaign(
    me: CurrentActor,
    dto: SaveCampaignDto,
  ): Promise<AdminCampaign> {
    const { button, ...content } = this.content(dto);
    const created = await this.campaignModel.create({
      ...content,
      ...(button && { button }),
      kind: 'manual',
      status: 'draft',
      createdBy: me.name,
    });
    return toCampaign(created);
  }

  async updateCampaign(
    id: string,
    dto: SaveCampaignDto,
  ): Promise<AdminCampaign> {
    const row = await this.findCampaign(id);
    if (!EDITABLE.includes(row.status))
      throw new BadRequestException(
        'This newsletter has already gone out. Duplicate it to send something similar.',
      );
    if (dto.version && dto.version !== versionOf(row)) throw changedMeanwhile();
    const { button, ...rest } = this.content(dto, row);
    const updated = await this.campaignModel
      .findOneAndUpdate(
        { _id: row._id, updatedAt: row.updatedAt },
        {
          $set: { ...rest, needsReview: false, ...(button && { button }) },
          ...(button === null && { $unset: { button: 1 } }),
        },
        { returnDocument: 'after' },
      )
      .lean<CampaignRow>();
    if (!updated) throw changedMeanwhile();
    return toCampaign(updated);
  }

  async duplicateCampaign(
    me: CurrentActor,
    id: string,
  ): Promise<AdminCampaign> {
    const row = await this.findCampaign(id);
    const created = await this.campaignModel.create({
      kind: 'manual',
      status: 'draft',
      subject: row.subject,
      preheader: row.preheader,
      heading: row.heading,
      body: row.body,
      ...(row.button && { button: row.button }),
      dishIds: row.dishIds,
      createdBy: me.name,
    });
    return toCampaign(created);
  }

  async deleteCampaign(id: string): Promise<{ deleted: true }> {
    const row = await this.findCampaign(id);
    if (row.status === 'sending')
      throw new BadRequestException('Pause or cancel it before deleting it.');
    await this.campaignModel.deleteOne({ _id: row._id });
    return { deleted: true };
  }

  async preview(
    dto: SaveCampaignDto,
  ): Promise<{ subject: string; html: string }> {
    const content = this.content(dto);
    const email = await this.sender.render(
      { ...content, button: content.button ?? null },
      '#',
    );
    return { subject: email.subject, html: email.html };
  }

  async test(
    me: CurrentActor,
    id: string,
    email?: string,
  ): Promise<{ sentTo: string }> {
    const row = await this.findCampaign(id);
    this.ready(row);
    const to =
      email ??
      (
        await this.userModel
          .findById(me.id, { email: 1 })
          .lean<{ email: string }>()
      )?.email;
    if (!to)
      throw new BadRequestException('Enter an email to send the test to.');
    await this.sender.sendTest(row, to);
    return { sentTo: to };
  }

  async send(
    me: CurrentActor,
    id: string,
    dto: SendCampaignDto,
  ): Promise<AdminCampaign> {
    const row = await this.findCampaign(id);
    if (!EDITABLE.includes(row.status))
      throw new BadRequestException('This newsletter has already gone out.');
    if (dto.version !== versionOf(row)) throw changedMeanwhile();
    this.ready(row);
    if (!this.config.settings().newsletter.enabled)
      throw new BadRequestException(
        'The newsletter is turned off in the website settings (features.newsletter).',
      );
    if (!(await this.subscriberModel.exists({ status: 'subscribed' })))
      throw new BadRequestException('Nobody is on the list yet.');

    if (dto.at) {
      const at = new Date(dto.at);
      if (at.getTime() < Date.now() + 60_000)
        throw new BadRequestException(
          'Pick a time at least a minute from now, or send it now.',
        );
      if (at.getTime() > Date.now() + 365 * DAY_MS)
        throw new BadRequestException('Pick a time within the next year.');
      const updated = await this.campaignModel
        .findOneAndUpdate(
          { _id: row._id, updatedAt: row.updatedAt },
          {
            $set: {
              status: 'scheduled',
              scheduledAt: at,
              needsReview: false,
              sentBy: me.name,
            },
          },
          { returnDocument: 'after' },
        )
        .lean<CampaignRow>();
      if (!updated) throw changedMeanwhile();
      return toCampaign(updated);
    }

    await this.sender.start(row._id, me.name);
    void this.sender.tick();
    return this.campaign(id);
  }

  async setState(
    id: string,
    action: 'unschedule' | 'pause' | 'resume' | 'cancel',
  ): Promise<AdminCampaign> {
    const row = await this.findCampaign(id);
    const moves: Record<
      typeof action,
      { from: CampaignStatus[]; set: Partial<Campaign> }
    > = {
      unschedule: { from: ['scheduled'], set: { status: 'draft' } },
      pause: { from: ['sending'], set: { status: 'paused' } },
      resume: { from: ['paused'], set: { status: 'sending', failStreak: 0 } },
      cancel: {
        from: ['sending', 'paused', 'scheduled'],
        set: { status: 'cancelled' },
      },
    };
    const move = moves[action];
    if (!move.from.includes(row.status))
      throw new BadRequestException(
        'That isn’t possible for this newsletter right now. Refresh to see its latest state.',
      );
    const updated = await this.campaignModel
      .findOneAndUpdate(
        { _id: row._id, status: row.status },
        {
          $set: move.set,
          ...(action === 'unschedule' && { $unset: { scheduledAt: 1 } }),
        },
        { returnDocument: 'after' },
      )
      .lean<CampaignRow>();
    if (!updated) throw changedMeanwhile();
    if (action === 'resume') void this.sender.tick();
    return toCampaign(updated);
  }

  async dishOptions(): Promise<DishOption[]> {
    const rows = await this.itemModel
      .find({ isActive: true }, { name: 1, image: 1, categoryId: 1 })
      .populate<{ categoryId: { name: string } | null }>('categoryId', 'name')
      .sort({ name: 1 })
      .lean<
        {
          _id: Types.ObjectId;
          name: string;
          image?: string;
          categoryId: { name: string } | null;
        }[]
      >();
    const dishes = await this.sender.dishes(rows.map((r) => r._id));
    return rows.map((r, i) => ({
      id: String(r._id),
      name: r.name,
      image: dishes[i]?.image,
      category: r.categoryId?.name ?? '',
    }));
  }

  private content(
    dto: SaveCampaignDto,
    base?: CampaignRow,
  ): Omit<CampaignContent, 'button' | 'dishIds'> & {
    button?: Campaign['button'] | null;
    dishIds: Types.ObjectId[];
  } {
    return {
      subject: dto.subject ?? base?.subject ?? '',
      preheader: dto.preheader ?? base?.preheader ?? '',
      heading: dto.heading ?? base?.heading ?? '',
      body: dto.body ?? base?.body ?? '',
      button: dto.button === undefined ? undefined : dto.button,
      dishIds: (dto.dishIds ?? base?.dishIds?.map(String) ?? []).map(
        (d) => new Types.ObjectId(d),
      ),
    };
  }

  private ready(row: Pick<Campaign, 'subject' | 'body' | 'heading'>) {
    const missing = [
      !row.subject.trim() && 'a subject',
      !row.body.trim() && !row.heading.trim() && 'some text',
    ].filter(Boolean);
    if (missing.length)
      throw new BadRequestException(`Add ${missing.join(' and ')} first.`);
  }

  private async findCampaign(id: string): Promise<CampaignRow> {
    if (!isValidObjectId(id))
      throw new NotFoundException('Newsletter not found');
    const row = await this.campaignModel.findById(id).lean<CampaignRow>();
    if (!row) throw new NotFoundException('Newsletter not found');
    return row;
  }

  async automations(): Promise<AutomationsView> {
    const [settings, pending, recent] = await Promise.all([
      this.sender.settings(),
      this.sender.pendingSales(),
      this.campaignModel
        .find({ kind: 'sale' }, { body: 0 })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean<CampaignRow[]>(),
    ]);
    const { sale, welcome } = settings;
    const next = sale.lastSentAt
      ? new Date(
          new Date(sale.lastSentAt).getTime() + sale.cooldownDays * DAY_MS,
        )
      : null;
    return {
      welcome: {
        enabled: welcome.enabled !== false,
        message: welcome.message ?? '',
      },
      sale: {
        enabled: !!sale.enabled,
        mode: sale.mode ?? 'review',
        minPercent: sale.minPercent ?? 10,
        cooldownDays: sale.cooldownDays ?? 3,
        intro: sale.intro ?? '',
        lastSentAt: iso(sale.lastSentAt),
      },
      pending: sale.enabled
        ? pending.map((p) => ({
            id: p.id,
            name: p.name,
            percentOff: p.percentOff,
            hours: windowsLabel(p.windows),
          }))
        : [],
      nextAllowedAt:
        next && next.getTime() > Date.now() ? next.toISOString() : null,
      recent: recent.map(toSummary),
    };
  }

  async saveAutomations(dto: AutomationsDto): Promise<AutomationsView> {
    const before = await this.sender.settings();
    const set: Record<string, unknown> = {};
    if (dto.welcome) {
      set['welcome.enabled'] = dto.welcome.enabled;
      set['welcome.message'] = dto.welcome.message;
    }
    if (dto.sale) {
      set['sale.enabled'] = dto.sale.enabled;
      set['sale.mode'] = dto.sale.mode;
      set['sale.minPercent'] = dto.sale.minPercent;
      set['sale.cooldownDays'] = dto.sale.cooldownDays;
      set['sale.intro'] = dto.sale.intro;
      if (dto.sale.enabled && !before.sale.enabled)
        set['sale.enabledAt'] = new Date();
    }
    await this.settingsModel.updateOne(
      { _id: 'newsletter' },
      { $set: set },
      { upsert: true },
    );
    if (dto.sale?.enabled && !before.sale.enabled)
      await this.sender.baselineSales();
    return this.automations();
  }

  async salePreview(): Promise<{ subject: string; html: string } | null> {
    const pending = await this.sender.pendingSales();
    if (!pending.length) return null;
    const { sale } = await this.sender.settings();
    const content = await this.sender.saleContent(pending, sale.intro ?? '');
    const email = await this.sender.render(content, '#');
    return { subject: email.subject, html: email.html };
  }
}

function toSubscriber(r: SubscriberRow): AdminSubscriber {
  return {
    id: String(r._id),
    email: r.email,
    status: r.status,
    source: r.source,
    createdAt: iso(r.createdAt)!,
    confirmedAt: iso(r.confirmedAt),
    unsubscribedAt: iso(r.unsubscribedAt),
    unsubscribeReason: r.unsubscribeReason ?? null,
  };
}

function toSummary(c: CampaignRow): CampaignSummary {
  return {
    id: String(c._id),
    kind: c.kind,
    status: c.status,
    subject: c.subject,
    preheader: c.preheader,
    needsReview: !!c.needsReview,
    scheduledAt: iso(c.scheduledAt),
    startedAt: iso(c.startedAt),
    sentAt: iso(c.sentAt),
    stats: {
      recipients: c.stats?.recipients ?? 0,
      sent: c.stats?.sent ?? 0,
      failed: c.stats?.failed ?? 0,
    },
    createdBy: c.createdBy ?? null,
    sentBy: c.sentBy ?? null,
    updatedAt: iso(c.updatedAt)!,
  };
}

function toCampaign(c: CampaignRow): AdminCampaign {
  return {
    ...toSummary(c),
    heading: c.heading,
    body: c.body,
    button: c.button ? { label: c.button.label, url: c.button.url } : null,
    dishIds: (c.dishIds ?? []).map(String),
    lastError: c.lastError ?? null,
    version: versionOf(c),
  };
}
