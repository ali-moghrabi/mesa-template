import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  PayloadTooLargeException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { Authorize } from 'decorators/permission.decorator';
import { MediaService } from './media.service';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

@Controller('admin/media')
@Authorize('menu:manage')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('menu-images')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 },
    }),
  )
  async uploadMenuImage(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file)
      throw new BadRequestException(
        'Attach the photo in a field named "file".',
      );
    if (file.size > MAX_UPLOAD_BYTES)
      throw new PayloadTooLargeException('The photo is larger than 15 MB.');
    return this.media.uploadMenuImage(file.buffer);
  }
}
