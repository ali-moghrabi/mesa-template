import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types, type QueryFilter, type Model } from 'mongoose';
import type { CurrentActor } from 'decorators/current-user.decorator';
import { escapeRegex } from 'lib/pagination';
import {
  Message,
  type MessageDocument,
  type MessageFolder,
  type MessageStatus,
} from 'src/schemas/message.schema';
import { User, type UserDocument } from 'src/schemas/user.schema';
import { MailService } from 'src/features/mail/mail.service';
import {
  contactNotificationEmail,
  messageReplyEmail,
} from 'src/features/mail/templates';
import { OrderingConfig } from 'src/features/orders/ordering.config';
import type {
  BulkAction,
  ListMessagesQuery,
  MessageView,
  SendMessageDto,
  UpdateMessageDto,
} from './dto/message.dto';

export type MessageSummary = {
  id: string;
  name: string;
  email: string;
  subject: string;
  preview: string;
  status: MessageStatus;
  folder: MessageFolder;
  starred: boolean;
  replies: number;
  createdAt: string;
};

export type MessageDetail = MessageSummary & {
  phone: string;
  body: string;
  thread: { body: string; at: string; by: string }[];
  staffNote: string;
  readAt: string | null;
  readBy: string | null;
  hasAccount: boolean;
  others: {
    id: string;
    subject: string;
    status: MessageStatus;
    createdAt: string;
  }[];
};

export type MessageCounts = Record<MessageView, number>;
export type MessagesPage = {
  items: MessageSummary[];
  total: number;
  page: number;
  pages: number;
  counts: MessageCounts;
  subjects: string[];
};

type MessageRow = Message & { _id: Types.ObjectId };

const PAGE_SIZE = 25;
const DUPLICATE_MS = 10 * 60_000;
const FALLBACK_SUBJECT = 'General question';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: OrderingConfig,
    private readonly mail: MailService,
  ) {}

  async submit(dto: SendMessageDto): Promise<{ ok: true }> {
    const contact = this.config.contact();
    if (!contact.enabled)
      throw new ForbiddenException(
        'The contact form is off right now. Please call or email us.',
      );
    if (dto.website) return { ok: true };

    const email = dto.email.toLowerCase();
    const subject =
      dto.subject &&
      (contact.subjects.length === 0 || contact.subjects.includes(dto.subject))
        ? dto.subject
        : (contact.subjects[0] ?? FALLBACK_SUBJECT);
    const again = await this.messageModel.exists({
      email,
      body: dto.message,
      createdAt: { $gte: new Date(Date.now() - DUPLICATE_MS) },
    });
    if (again) return { ok: true };

    const links = (dto.message.match(/https?:\/\/|www\./gi) ?? []).length;
    const spam = links >= 3 || /\[url=|<a\s+href/i.test(dto.message);

    const created = await this.messageModel.create({
      name: dto.name,
      email,
      phone: dto.phone ?? '',
      subject,
      body: dto.message,
      folder: spam ? 'spam' : 'inbox',
    });

    if (!spam && contact.recipient) {
      const brand = this.mail.brand();
      this.mail
        .send(
          contact.recipient,
          contactNotificationEmail(brand, {
            message: this.summary(created.toObject() as MessageRow),
            body: dto.message,
            phone: dto.phone ?? '',
            link: `${brand.webUrl}/admin/messages?message=${created._id.toString()}`,
          }),
          {
            replyTo: email,
          },
        )
        .catch((error: unknown) =>
          this.logger.error(
            `New-message email failed: ${(error as Error).message}`,
          ),
        );
    }
    return { ok: true };
  }

  async list(query: ListMessagesQuery): Promise<MessagesPage> {
    const view = query.view ?? 'inbox';
    const filter: QueryFilter<MessageDocument> = { ...VIEW_FILTERS[view] };
    const q = query.q?.trim();
    if (q) {
      const text = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { name: text },
        { email: text },
        { subject: text },
        { body: text },
        { phone: text },
      ];
    }
    if (query.subject) filter.subject = query.subject;

    const page = query.page ?? 1;
    const [rows, total, counts, subjects] = await Promise.all([
      this.messageModel
        .find(filter, { staffNote: 0 })
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<MessageRow[]>(),
      this.messageModel.countDocuments(filter),
      this.counts(),
      this.messageModel.distinct('subject', { folder: { $ne: 'spam' } }),
    ]);
    return {
      items: rows.map((r) => this.summary(r)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts,
      subjects: subjects.sort(),
    };
  }

  async counts(): Promise<MessageCounts> {
    const entries = await Promise.all(
      (Object.keys(VIEW_FILTERS) as MessageView[]).map(
        async (v) =>
          [v, await this.messageModel.countDocuments(VIEW_FILTERS[v])] as const,
      ),
    );
    return Object.fromEntries(entries) as MessageCounts;
  }

  async unreadCount(): Promise<{ count: number }> {
    return {
      count: await this.messageModel.countDocuments(VIEW_FILTERS.unread),
    };
  }

  async get(actor: CurrentActor, id: string): Promise<MessageDetail> {
    const row = await this.find(id);
    if (row.status === 'new') {
      const read = await this.messageModel
        .findOneAndUpdate(
          { _id: row._id, status: 'new' },
          { $set: { status: 'read', readAt: new Date(), readBy: actor.name } },
          { returnDocument: 'after' },
        )
        .lean<MessageRow>();
      if (read) return this.detail(read);
    }
    return this.detail(row);
  }

  async update(id: string, dto: UpdateMessageDto): Promise<MessageDetail> {
    const row = await this.find(id);
    const set: Partial<Message> = {};
    if (dto.starred !== undefined) set.starred = dto.starred;
    if (dto.folder) set.folder = dto.folder;
    if (dto.read === false) set.status = 'new';
    if (dto.read === true && row.status === 'new') set.status = 'read';
    const updated = await this.messageModel
      .findByIdAndUpdate(row._id, { $set: set }, { returnDocument: 'after' })
      .lean<MessageRow>();
    if (!updated) throw new NotFoundException('Message not found');
    return this.detail(updated);
  }

  async bulk(
    ids: string[],
    action: BulkAction,
  ): Promise<{ changed: number; counts: MessageCounts }> {
    const _id = { $in: ids.map((i) => new Types.ObjectId(i)) };
    let changed = 0;
    if (action === 'delete') {
      changed = (await this.messageModel.deleteMany({ _id })).deletedCount;
    } else {
      const update: Record<
        Exclude<BulkAction, 'delete'>,
        { filter?: object; set: Partial<Message> }
      > = {
        read: { filter: { status: 'new' }, set: { status: 'read' } },
        unread: { filter: { status: 'read' }, set: { status: 'new' } },
        star: { set: { starred: true } },
        unstar: { set: { starred: false } },
        archive: { set: { folder: 'archived' } },
        inbox: { set: { folder: 'inbox' } },
        spam: { set: { folder: 'spam' } },
      };
      const step = update[action];
      changed = (
        await this.messageModel.updateMany(
          { _id, ...step.filter },
          { $set: step.set },
        )
      ).modifiedCount;
    }
    return { changed, counts: await this.counts() };
  }

  async reply(
    actor: CurrentActor,
    id: string,
    body: string,
  ): Promise<MessageDetail> {
    const row = await this.find(id);
    const brand = this.mail.brand();
    const contact = this.config.contact();
    await this.mail.send(
      row.email,
      messageReplyEmail(brand, {
        name: row.name,
        subject: row.subject,
        reply: body,
        original: row.body,
        sentAt: row.createdAt,
        from: actor.name,
      }),
      {
        ...(contact.recipient && { replyTo: contact.recipient }),
      },
    );
    const updated = await this.messageModel
      .findByIdAndUpdate(
        row._id,
        {
          $set: {
            status: 'replied',
            ...(row.folder === 'spam' && { folder: 'inbox' }),
          },
          $push: { replies: { body, at: new Date(), by: actor.name } },
        },
        { returnDocument: 'after' },
      )
      .lean<MessageRow>();
    if (!updated) throw new NotFoundException('Message not found');
    return this.detail(updated);
  }

  async setNote(id: string, note: string): Promise<MessageDetail> {
    const row = await this.find(id);
    const updated = await this.messageModel
      .findByIdAndUpdate(
        row._id,
        { $set: { staffNote: note } },
        { returnDocument: 'after' },
      )
      .lean<MessageRow>();
    if (!updated) throw new NotFoundException('Message not found');
    return this.detail(updated);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const row = await this.find(id);
    await this.messageModel.deleteOne({ _id: row._id });
    return { deleted: true };
  }

  private async find(id: string): Promise<MessageRow> {
    if (!isValidObjectId(id)) throw new NotFoundException('Message not found');
    const row = await this.messageModel.findById(id).lean<MessageRow>();
    if (!row) throw new NotFoundException('Message not found');
    return row;
  }

  private summary(r: MessageRow): MessageSummary {
    return {
      id: r._id.toString(),
      name: r.name,
      email: r.email,
      subject: r.subject,
      preview: r.body.replace(/\s+/g, ' ').slice(0, 160),
      status: r.status,
      folder: r.folder,
      starred: r.starred,
      replies: r.replies?.length ?? 0,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  }

  private async detail(r: MessageRow): Promise<MessageDetail> {
    const [account, others] = await Promise.all([
      this.userModel.exists({ email: r.email }),
      this.messageModel
        .find(
          { email: r.email, _id: { $ne: r._id } },
          { subject: 1, status: 1, createdAt: 1 },
        )
        .sort({ createdAt: -1 })
        .limit(10)
        .lean<Pick<MessageRow, '_id' | 'subject' | 'status' | 'createdAt'>[]>(),
    ]);
    return {
      ...this.summary(r),
      phone: r.phone ?? '',
      body: r.body,
      thread: (r.replies ?? []).map((x) => ({
        body: x.body,
        at: new Date(x.at).toISOString(),
        by: x.by,
      })),
      staffNote: r.staffNote ?? '',
      readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
      readBy: r.readBy ?? null,
      hasAccount: Boolean(account),
      others: others.map((o) => ({
        id: o._id.toString(),
        subject: o.subject,
        status: o.status,
        createdAt: new Date(o.createdAt).toISOString(),
      })),
    };
  }
}

const VIEW_FILTERS: Record<MessageView, QueryFilter<MessageDocument>> = {
  inbox: { folder: 'inbox' },
  unread: { folder: 'inbox', status: 'new' },
  starred: { starred: true, folder: { $ne: 'spam' } },
  archived: { folder: 'archived' },
  spam: { folder: 'spam' },
};
