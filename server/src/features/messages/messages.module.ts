import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from 'src/schemas/message.schema';
import { User, UserSchema } from 'src/schemas/user.schema';
import { OrdersModule } from 'src/features/orders/orders.module';
import {
  MessagesAdminController,
  MessagesController,
} from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    OrdersModule,
  ],
  controllers: [MessagesController, MessagesAdminController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
