import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Authorize } from 'decorators/permission.decorator';
import {
  AddGalleryPhotosDto,
  BulkUpdateGalleryDto,
  DeleteGalleryPhotosDto,
  ReorderGalleryDto,
  UpdateGalleryPhotoDto,
} from './dto/gallery.dto';
import { GalleryService } from './gallery.service';

/** Public: the website's gallery page. */
@Controller('gallery')
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  /** GET /api/v1/gallery → visible photos, in order */
  @Get()
  list() {
    return this.gallery.publicList();
  }
}

/**
 * The admin gallery. content:manage (managers and admins).
 * Photos are uploaded first through POST /admin/media/menu-images, then added here with their key.
 */
@Controller('admin/gallery')
@Authorize('content:manage')
export class AdminGalleryController {
  constructor(private readonly gallery: GalleryService) {}

  /** GET /api/v1/admin/gallery → every photo, hidden ones included */
  @Get()
  list() {
    return this.gallery.list();
  }

  /** POST /api/v1/admin/gallery { photos: [{ image, width, height, alt?, album? }] } → { added, failed } */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@Body() dto: AddGalleryPhotosDto) {
    return this.gallery.add(dto);
  }

  /** POST /api/v1/admin/gallery/bulk { ids, set: { album?, isVisible?, isFeatured? } } */
  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  bulk(@Body() dto: BulkUpdateGalleryDto) {
    return this.gallery.bulkUpdate(dto.ids, dto.set);
  }

  /** POST /api/v1/admin/gallery/reorder { ids } — every photo, in the new order. 409 if the gallery changed. */
  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  reorder(@Body() dto: ReorderGalleryDto) {
    return this.gallery.reorder(dto.ids);
  }

  /** POST /api/v1/admin/gallery/delete { ids } — photos and their S3 files */
  @Post('delete')
  @HttpCode(HttpStatus.OK)
  remove(@Body() dto: DeleteGalleryPhotosDto) {
    return this.gallery.remove(dto.ids);
  }

  /** PATCH /api/v1/admin/gallery/:id { alt?, caption?, album?, isVisible?, isFeatured? } */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGalleryPhotoDto) {
    return this.gallery.update(id, dto);
  }
}
