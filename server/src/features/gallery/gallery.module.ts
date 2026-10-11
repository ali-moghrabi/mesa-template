import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaModule } from 'src/features/media/media.module';
import {
  GalleryPhoto,
  GalleryPhotoSchema,
} from 'src/schemas/gallery-photo.schema';
import {
  AdminGalleryController,
  GalleryController,
} from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GalleryPhoto.name, schema: GalleryPhotoSchema },
    ]),
    MediaModule,
  ],
  controllers: [GalleryController, AdminGalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
