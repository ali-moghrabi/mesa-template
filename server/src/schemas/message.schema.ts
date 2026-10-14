import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export const MESSAGE_STATUSES = ['new', 'read', 'replied'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
export const MESSAGE_FOLDERS = ['inbox', 'archived', 'spam'] as const;
export type MessageFolder = (typeof MESSAGE_FOLDERS)[number];

@Schema({ _id: false })
export class MessageReply {
  @Prop({ type: String, required: true }) body!: string;
  @Prop({ type: Date, default: () => new Date() }) at!: Date;
  @Prop({ type: String, required: true }) by!: string;
}
const MessageReplySchema = SchemaFactory.createForClass(MessageReply);

@Schema({ collection: 'messages', timestamps: true })
export class Message {
  @Prop({ type: String, required: true }) name!: string;
  @Prop({ type: String, required: true, lowercase: true, index: true })
  email!: string;
  @Prop({ type: String, default: '' }) phone!: string;
  @Prop({ type: String, required: true }) subject!: string;
  @Prop({ type: String, required: true }) body!: string;

  @Prop({ type: String, enum: MESSAGE_STATUSES, default: 'new' })
  status!: MessageStatus;
  @Prop({ type: String, enum: MESSAGE_FOLDERS, default: 'inbox' })
  folder!: MessageFolder;
  @Prop({ type: Boolean, default: false }) starred!: boolean;

  @Prop({ type: Date }) readAt?: Date;
  @Prop({ type: String }) readBy?: string;

  @Prop({ type: [MessageReplySchema], default: [] }) replies!: MessageReply[];
  @Prop({ type: String, default: '' }) staffNote!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ folder: 1, createdAt: -1 });
MessageSchema.index({ status: 1, folder: 1 });
