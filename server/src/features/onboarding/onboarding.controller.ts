import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import {
  OnboardingService,
  type OnboardingUploads,
} from './onboarding.service';

const MAX_FILE_BYTES = 15 * 1024 * 1024;

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'photos', maxCount: 15 },
        { name: 'menu', maxCount: 5 },
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: MAX_FILE_BYTES,
          files: 21,
          fields: 4,
          fieldSize: 500_000,
        },
      },
    ),
  )
  submit(
    @Body() body: { data?: string; config?: string; website?: string },
    @UploadedFiles() files: OnboardingUploads = {},
  ) {
    if (body.website) return { id: 'ok' };
    return this.onboarding.submit(body, files);
  }
}
