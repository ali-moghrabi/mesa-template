import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Campaign,
  CampaignSchema,
  NewsletterSettings,
  NewsletterSettingsSchema,
  SaleAnnouncement,
  SaleAnnouncementSchema,
} from 'src/schemas/campaign.schema';
import { MenuCategory, MenuCategorySchema } from 'src/schemas/category.schema';
import { MenuItem, MenuItemSchema } from 'src/schemas/item.schema';
import { Promotion, PromotionSchema } from 'src/schemas/promotion.schema';
import { Subscriber, SubscriberSchema } from 'src/schemas/subscriber.schema';
import { User, UserSchema } from 'src/schemas/user.schema';
import { OrdersModule } from 'src/features/orders/orders.module';
import { PromotionsModule } from 'src/features/promotions/promotions.module';
import { NewsletterAdminController } from './newsletter-admin.controller';
import { NewsletterAdminService } from './newsletter-admin.service';
import { NewsletterSender } from './newsletter-sender.service';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscriber.name, schema: SubscriberSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: NewsletterSettings.name, schema: NewsletterSettingsSchema },
      { name: SaleAnnouncement.name, schema: SaleAnnouncementSchema },
      { name: User.name, schema: UserSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: MenuCategory.name, schema: MenuCategorySchema },
      { name: Promotion.name, schema: PromotionSchema },
    ]),
    OrdersModule,
    PromotionsModule,
  ],
  controllers: [NewsletterController, NewsletterAdminController],
  providers: [NewsletterService, NewsletterSender, NewsletterAdminService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
