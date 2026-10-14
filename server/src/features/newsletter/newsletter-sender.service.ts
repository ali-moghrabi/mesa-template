import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { mediaUrl } from 'lib/media-url';
import { fromMinor } from 'lib/money';
import {
  appliesTo,
  promotionState,
  whenLabel,
  windowsLabel,
  type PromotionRule,
} from 'lib/promotions';
import {
  Campaign,
  NewsletterSettings,
  SaleAnnouncement,
  type CampaignDocument,
  type NewsletterSettingsDocument,
  type SaleAnnouncementDocument,
} from 'src/schemas/campaign.schema';
import {
  MenuCategory,
  type MenuCategoryDocument,
} from 'src/schemas/category.schema';
import { MenuItem, type MenuItemDocument } from 'src/schemas/item.schema';
import {
  Promotion,
  type PromotionDocument,
} from 'src/schemas/promotion.schema';
import {
  Subscriber,
  type SubscriberDocument,
} from 'src/schemas/subscriber.schema';
import { MailService } from 'src/features/mail/mail.service';
import {
  absoluteUrl,
  campaignEmail,
  type EmailContent,
  type EmailDish,
} from 'src/features/mail/templates';
import { OrderingConfig } from 'src/features/orders/ordering.config';
import { PromotionsService } from 'src/features/promotions/promotions.service';

export type CampaignContent = {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  button?: { label: string; url: string } | null;
  dishIds: (string | Types.ObjectId)[];
};

const SETTINGS_ID = 'newsletter';
const DAY_MS = 24 * 60 * 60_000;
const BATCH = 40;
const TICK_MS = 15_000;
const LOCK_MS = 2 * 60_000;
const SALE_CHECK_MS = 5 * 60_000;
const UNSUBSCRIBE = '__MESA_UNSUBSCRIBE__';

type ItemRow = {
  _id: Types.ObjectId;
  name: string;
  image?: string;
  price: number;
  categoryId: Types.ObjectId;
  isAvailable?: boolean;
  variants?: { price: number }[];
};

@Injectable()
export class NewsletterSender
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(NewsletterSender.name);
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private lastSaleCheck = 0;

  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(NewsletterSettings.name)
    private readonly settingsModel: Model<NewsletterSettingsDocument>,
    @InjectModel(SaleAnnouncement.name)
    private readonly announcementModel: Model<SaleAnnouncementDocument>,
    @InjectModel(Subscriber.name)
    private readonly subscriberModel: Model<SubscriberDocument>,
    @InjectModel(MenuItem.name)
    private readonly itemModel: Model<MenuItemDocument>,
    @InjectModel(MenuCategory.name)
    private readonly categoryModel: Model<MenuCategoryDocument>,
    @InjectModel(Promotion.name)
    private readonly promotionModel: Model<PromotionDocument>,
    private readonly promotions: PromotionsService,
    private readonly config: OrderingConfig,
    private readonly mail: MailService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NEWSLETTER_WORKER === 'off') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async settings(): Promise<NewsletterSettings> {
    const found = await this.settingsModel
      .findById(SETTINGS_ID)
      .lean<NewsletterSettings>();
    if (found) return found;
    return this.settingsModel
      .findOneAndUpdate(
        { _id: SETTINGS_ID },
        { $setOnInsert: { _id: SETTINGS_ID } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .lean<NewsletterSettings>()
      .then((row) => row);
  }

  async render(
    content: CampaignContent,
    unsubscribeLink: string,
  ): Promise<EmailContent> {
    const brand = this.mail.brand();
    const dishes = await this.dishes(content.dishIds);
    return campaignEmail(brand, {
      subject: content.subject || `News from ${brand.name}`,
      preheader: content.preheader,
      heading: content.heading,
      body: content.body,
      button: content.button ?? undefined,
      dishes,
      unsubscribeLink,
    });
  }

  async dishes(ids: (string | Types.ObjectId)[]): Promise<EmailDish[]> {
    if (!ids.length) return [];
    const brand = this.mail.brand();
    const currency = this.config.rules().currency;
    const money = (minor: number) => {
      const value = fromMinor(minor) ?? 0;
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).format(value);
      } catch {
        return value.toFixed(2);
      }
    };
    const [rows, pricing] = await Promise.all([
      this.itemModel
        .find(
          { _id: { $in: ids }, isActive: true },
          { name: 1, image: 1, price: 1, categoryId: 1, variants: 1 },
        )
        .lean<ItemRow[]>(),
      this.promotions.pricing(),
    ]);
    const byId = new Map(rows.map((r) => [String(r._id), r]));
    return ids
      .map((id) => byId.get(String(id)))
      .filter((r): r is ItemRow => !!r)
      .map((r) => {
        const base = r.variants?.length
          ? Math.min(...r.variants.map((v) => v.price))
          : r.price;
        const sale = pricing.saleFor({
          id: String(r._id),
          categoryId: String(r.categoryId),
        });
        const now = sale ? sale.price(base) : base;
        const image = mediaUrl(r.image);
        return {
          name: r.name,
          image: image
            ? (absoluteUrl(image, brand) ??
              `${brand.webUrl}/${image.replace(/^\/+/, '')}`)
            : undefined,
          price: `${r.variants && r.variants.length > 1 ? 'from ' : ''}${money(now)}`,
          ...(sale &&
            now < base && {
              was: money(base),
              badge: `−${sale.info.percentOff}%`,
            }),
          link: `${brand.webUrl}/menu`,
        };
      });
  }

  async sendTest(content: CampaignContent, to: string): Promise<void> {
    const email = await this.render(
      content,
      `${this.mail.brand().webUrl}/newsletter`,
    );
    await this.mail.send(to, { ...email, subject: `[Test] ${email.subject}` });
  }

  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.startDue();
      const until = Date.now() + 10_000;
      while (Date.now() < until && (await this.sendBatch())) {
        /* next batch */
      }
      if (Date.now() - this.lastSaleCheck > SALE_CHECK_MS) {
        this.lastSaleCheck = Date.now();
        await this.checkSales();
      }
    } catch (error) {
      this.logger.error(`Newsletter worker: ${(error as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  private async startDue() {
    const due = await this.campaignModel
      .find(
        { status: 'scheduled', scheduledAt: { $lte: new Date() } },
        { _id: 1 },
      )
      .lean<{ _id: Types.ObjectId }[]>();
    for (const c of due) await this.start(c._id);
  }

  async start(id: Types.ObjectId | string, by?: string): Promise<void> {
    const recipients = await this.subscriberModel.countDocuments({
      status: 'subscribed',
    });
    await this.campaignModel.updateOne(
      { _id: id, status: { $in: ['draft', 'scheduled'] } },
      {
        $set: {
          status: 'sending',
          startedAt: new Date(),
          'stats.recipients': recipients,
          needsReview: false,
          failStreak: 0,
          ...(by && { sentBy: by }),
        },
        $unset: { cursor: 1, lastError: 1 },
      },
    );
  }

  private async sendBatch(): Promise<boolean> {
    const now = new Date();
    const campaign = await this.campaignModel
      .findOneAndUpdate(
        {
          status: 'sending',
          $or: [
            { lockedUntil: { $exists: false } },
            { lockedUntil: { $lt: now } },
          ],
        },
        { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) } },
        { returnDocument: 'after', sort: { startedAt: 1 } },
      )
      .lean<Campaign & { _id: Types.ObjectId }>();
    if (!campaign) return false;

    const recipients = await this.subscriberModel
      .find(
        {
          status: 'subscribed',
          ...(campaign.cursor && { _id: { $gt: campaign.cursor } }),
        },
        { email: 1, unsubscribeToken: 1 },
      )
      .select('+unsubscribeToken')
      .sort({ _id: 1 })
      .limit(BATCH)
      .lean<
        { _id: Types.ObjectId; email: string; unsubscribeToken: string }[]
      >();

    if (!recipients.length) {
      await this.campaignModel.updateOne(
        { _id: campaign._id },
        {
          $set: { status: 'sent', sentAt: new Date() },
          $unset: { lockedUntil: 1 },
        },
      );
      this.logger.log(
        `Newsletter "${campaign.subject}" sent: ${campaign.stats.sent} delivered, ${campaign.stats.failed} failed`,
      );
      return true;
    }

    const brand = this.mail.brand();
    const email = await this.render(campaign, UNSUBSCRIBE);
    let sent = 0;
    let failed = 0;
    let lastError = '';

    for (let i = 0; i < recipients.length; i += 4) {
      await Promise.all(
        recipients.slice(i, i + 4).map(async (r) => {
          const page = `${brand.webUrl}/newsletter?unsubscribe=${r.unsubscribeToken}`;
          const oneClick = `${brand.webUrl}/newsletter/one-click?token=${r.unsubscribeToken}`;
          try {
            await this.mail.send(
              r.email,
              {
                subject: email.subject,
                html: email.html.split(UNSUBSCRIBE).join(page),
                text: email.text.split(UNSUBSCRIBE).join(page),
              },
              {
                headers: {
                  'List-Unsubscribe': `<${oneClick}>`,
                  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                },
              },
            );
            sent++;
          } catch (error) {
            failed++;
            lastError = (error as Error).message;
          }
        }),
      );
    }

    const allFailed = sent === 0;
    const streak = allFailed ? (campaign.failStreak ?? 0) + 1 : 0;
    const pause = streak >= 3;
    await this.campaignModel.updateOne(
      { _id: campaign._id },
      {
        $inc: { 'stats.sent': sent, 'stats.failed': failed },
        $set: {
          ...(!allFailed && { cursor: recipients[recipients.length - 1]._id }),
          failStreak: streak,
          ...(lastError && { lastError }),
          ...(pause && { status: 'paused' }),
        },
        $unset: { lockedUntil: 1 },
      },
    );
    if (pause)
      this.logger.error(
        `Newsletter "${campaign.subject}" paused: the mail server keeps failing (${lastError})`,
      );
    return !allFailed;
  }

  private async runningPromotions(
    minPercent: number,
  ): Promise<PromotionRule[]> {
    const rows = await this.promotionModel
      .find({ isActive: true })
      .lean<(Promotion & { _id: Types.ObjectId })[]>();
    const now = new Date();
    return rows
      .map((row): PromotionRule => ({
        id: String(row._id),
        name: row.name,
        percentOff: row.percentOff,
        roundTo: row.roundTo ?? 0,
        scope: row.scope,
        categoryIds: (row.categoryIds ?? []).map(String),
        dishIds: (row.dishIds ?? []).map(String),
        excludedDishIds: (row.excludedDishIds ?? []).map(String),
        startsAt: row.startsAt ?? null,
        endsAt: row.endsAt ?? null,
        windows: (row.windows ?? []).map((w) => ({
          days: w.days,
          from: w.from,
          to: w.to,
        })),
        timezone: row.timezone,
        isActive: row.isActive !== false,
      }))
      .filter(
        (r) =>
          r.percentOff >= minPercent &&
          promotionState(r, now).state === 'running',
      );
  }

  private signature = (r: PromotionRule) =>
    `${r.percentOff}|${r.startsAt ?? ''}|${r.endsAt ?? ''}`;

  async baselineSales(): Promise<void> {
    const running = await this.runningPromotions(1);
    for (const r of running) {
      await this.announcementModel
        .updateOne(
          { promotionId: r.id, signature: this.signature(r) },
          { $setOnInsert: { outcome: 'skipped' } },
          { upsert: true },
        )
        .catch(() => undefined);
    }
  }

  async pendingSales(): Promise<PromotionRule[]> {
    const { sale } = await this.settings();
    const running = await this.runningPromotions(sale.minPercent);
    if (!running.length) return [];
    const done = await this.announcementModel
      .find(
        { promotionId: { $in: running.map((r) => r.id) } },
        { promotionId: 1, signature: 1 },
      )
      .lean<{ promotionId: Types.ObjectId; signature: string }[]>();
    const seen = new Set(
      done.map((d) => `${String(d.promotionId)}#${d.signature}`),
    );
    return running.filter((r) => !seen.has(`${r.id}#${this.signature(r)}`));
  }

  async checkSales(): Promise<void> {
    if (!this.config.settings().newsletter.enabled) return;
    const { sale } = await this.settings();
    if (!sale.enabled) return;
    if (
      sale.lastSentAt &&
      Date.now() - new Date(sale.lastSentAt).getTime() <
        sale.cooldownDays * DAY_MS
    )
      return;

    const fresh = await this.pendingSales();
    if (!fresh.length) return;
    if (!(await this.subscriberModel.exists({ status: 'subscribed' }))) return;

    const { button, ...content } = await this.saleContent(fresh, sale.intro);
    const campaign = await this.campaignModel.create({
      ...content,
      ...(button && { button }),
      kind: 'sale',
      status: 'draft',
      needsReview: sale.mode === 'review',
      promotionIds: fresh.map((r) => new Types.ObjectId(r.id)),
      createdBy: 'Sale alert',
    });
    await this.announcementModel
      .insertMany(
        fresh.map((r) => ({
          promotionId: r.id,
          signature: this.signature(r),
          outcome: 'announced',
          campaignId: campaign._id,
        })),
        { ordered: false },
      )
      .catch(() => undefined);
    await this.settingsModel.updateOne(
      { _id: SETTINGS_ID },
      { $set: { 'sale.lastSentAt': new Date() } },
    );

    if (sale.mode === 'auto') {
      await this.start(campaign._id, 'Sale alert');
      this.logger.log(`Sale alert sending: ${content.subject}`);
    } else {
      this.logger.log(`Sale alert ready for review: ${content.subject}`);
    }
  }

  async saleContent(
    rules: PromotionRule[],
    intro: string,
  ): Promise<CampaignContent> {
    const brand = this.mail.brand();
    const best = rules.reduce((a, b) => (b.percentOff > a.percentOff ? b : a));
    const single = rules.length === 1;

    const [items, categories] = await Promise.all([
      this.itemModel
        .find(
          { isActive: true },
          { name: 1, image: 1, categoryId: 1, isAvailable: 1 },
        )
        .lean<ItemRow[]>(),
      this.categoryModel
        .find({}, { name: 1 })
        .lean<{ _id: Types.ObjectId; name: string }[]>(),
    ]);
    const categoryName = new Map(
      categories.map((c) => [String(c._id), c.name]),
    );

    const lines = rules.map((r) => {
      const what =
        r.scope === 'menu'
          ? 'the whole menu'
          : r.scope === 'categories'
            ? r.categoryIds
                .map((id) => categoryName.get(id))
                .filter(Boolean)
                .join(', ') || 'selected dishes'
            : 'selected dishes';
      const hours = r.windows.length ? ` (${windowsLabel(r.windows)})` : '';
      const until = r.endsAt
        ? `, until ${whenLabel(r.endsAt, r.timezone, new Date(), 'end')}`
        : '';
      return `- **${r.name}**: ${r.percentOff}% off ${what}${hours}${until}`;
    });

    const onSale = items
      .filter((i) =>
        rules.some((r) =>
          appliesTo(r, { id: String(i._id), categoryId: String(i.categoryId) }),
        ),
      )
      .sort(
        (a, b) =>
          Number(!!b.image) - Number(!!a.image) ||
          Number(b.isAvailable !== false) - Number(a.isAvailable !== false),
      )
      .slice(0, 6);

    return {
      subject: single
        ? `${best.name}: ${best.percentOff}% off at ${brand.name}`
        : `Sale on now at ${brand.name}: up to ${best.percentOff}% off`,
      preheader: single
        ? `${best.percentOff}% off ${lines[0].includes('the whole menu') ? 'the whole menu' : 'some of your favourites'}. Don't miss it.`
        : 'Several offers are on right now.',
      heading: single
        ? `${best.percentOff}% off: ${best.name}`
        : `Up to ${best.percentOff}% off right now`,
      body: [
        intro.trim() ||
          'Good news: some of your favourites are on sale right now.',
        lines.join('\n'),
        'The menu already shows the sale prices. See you soon!',
      ].join('\n\n'),
      button: { label: 'See the menu', url: '/menu' },
      dishIds: onSale.map((i) => i._id),
    };
  }
}
