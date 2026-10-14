import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Authorize } from 'decorators/permission.decorator';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import {
  BulkMessagesDto,
  ListMessagesQuery,
  MessageNoteDto,
  ReplyMessageDto,
  SendMessageDto,
  UpdateMessageDto,
} from './dto/message.dto';
import { MessagesService } from './messages.service';

/** POST /api/v1/messages: the website's contact form (no sign-in needed) */
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } }) // a person writes once; bots try many times
  send(@Body() dto: SendMessageDto) {
    return this.messages.submit(dto);
  }
}

/**
 * The admin panel's messages: managers and the owner only (content:manage).
 * Staff never see guests' messages.
 */
@Controller('admin/messages')
@Authorize('content:manage')
export class MessagesAdminController {
  constructor(private readonly messages: MessagesService) {}

  /** GET /api/v1/admin/messages?view=inbox|unread|starred|archived|spam&q&subject&page */
  @Get()
  list(@Query() query: ListMessagesQuery) {
    return this.messages.list(query);
  }

  /** GET /api/v1/admin/messages/unread-count → { count } (the sidebar badge) */
  @Get('unread-count')
  @SkipThrottle()
  unreadCount() {
    return this.messages.unreadCount();
  }

  /** POST /api/v1/admin/messages/bulk { ids, action } */
  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  bulk(@Body() dto: BulkMessagesDto) {
    return this.messages.bulk(dto.ids, dto.action);
  }

  /** GET /api/v1/admin/messages/:id → the message (marks it read) */
  @Get(':id')
  get(@CurrentUser() me: CurrentActor, @Param('id') id: string) {
    return this.messages.get(me, id);
  }

  /** PATCH /api/v1/admin/messages/:id { starred?, read?, folder? } */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMessageDto) {
    return this.messages.update(id, dto);
  }

  /** POST /api/v1/admin/messages/:id/reply { body }: emails the guest */
  @Post(':id/reply')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  reply(
    @CurrentUser() me: CurrentActor,
    @Param('id') id: string,
    @Body() dto: ReplyMessageDto,
  ) {
    return this.messages.reply(me, id, dto.body);
  }

  /** PATCH /api/v1/admin/messages/:id/note { note } */
  @Patch(':id/note')
  note(@Param('id') id: string, @Body() dto: MessageNoteDto) {
    return this.messages.setNote(id, dto.note);
  }

  /** DELETE /api/v1/admin/messages/:id */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.messages.remove(id);
  }
}
