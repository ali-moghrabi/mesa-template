import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MenuCategory, MenuCategorySchema } from 'src/schemas/category.schema';
import { MenuItem, MenuItemSchema } from 'src/schemas/item.schema';
import { MediaModule } from 'src/features/media/media.module';
import { AdminMenuController, MenuController } from './menu.controller';
import { MenuCategoriesService } from './categories.service';
import { MenuService } from './menu.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MenuCategory.name, schema: MenuCategorySchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
    MediaModule,
  ],
  controllers: [MenuController, AdminMenuController],
  providers: [MenuService, MenuCategoriesService],
  exports: [MenuService, MenuCategoriesService],
})
export class MenuModule {}
