import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  MESSAGE_FOLDERS,
  type MessageFolder,
} from 'src/schemas/message.schema';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/[^\S\n]+/g, ' ') : value,
);

const tidy = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value
        .replace(/\r\n?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : value,
);

export const MESSAGE_MAX = 3000;
export const REPLY_MAX = 5000;

export class SendMessageDto {
  @trim
  @IsString()
  @MinLength(2, { message: 'Enter your name' })
  @MaxLength(80)
  name!: string;

  @trim
  @IsEmail({}, { message: 'Enter a valid email' })
  @MaxLength(120)
  email!: string;

  @IsOptional()
  @trim
  @ValidateIf((_, value) => value !== '')
  @Matches(/^\+?[0-9][0-9 ()-]{5,22}$/, {
    message: 'Enter a valid phone number',
  })
  phone?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(80)
  subject?: string;

  @tidy
  @IsString()
  @MinLength(10, { message: 'Tell us a little more (10 characters at least)' })
  @MaxLength(MESSAGE_MAX, {
    message: `Keep it under ${MESSAGE_MAX} characters`,
  })
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export const MESSAGE_VIEWS = [
  'inbox',
  'unread',
  'starred',
  'archived',
  'spam',
] as const;
export type MessageView = (typeof MESSAGE_VIEWS)[number];

export class ListMessagesQuery {
  @IsOptional()
  @IsIn(MESSAGE_VIEWS)
  view?: MessageView;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(80)
  subject?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

export class UpdateMessageDto {
  @IsOptional()
  @IsBoolean()
  starred?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsIn(MESSAGE_FOLDERS)
  folder?: MessageFolder;
}

export const BULK_ACTIONS = [
  'read',
  'unread',
  'star',
  'unstar',
  'archive',
  'inbox',
  'spam',
  'delete',
] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

export class BulkMessagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids!: string[];

  @IsIn(BULK_ACTIONS)
  action!: BulkAction;
}

export class ReplyMessageDto {
  @tidy
  @IsString()
  @MinLength(2, { message: 'Write your reply' })
  @MaxLength(REPLY_MAX)
  body!: string;
}

export class MessageNoteDto {
  @trim
  @IsString()
  @MaxLength(1000)
  note!: string;
}
