import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UseGuards,
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

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 60 * 1024 * 1024;

/**
 * Runs before the upload is read. The form only exists on mesa-template.store: on every
 * restaurant's own API it's off (404), so nobody can use it to send email from MESA's sender.
 */
@Injectable()
class OnboardingOpenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.ONBOARDING_ENABLED !== 'true')
      throw new NotFoundException();
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const length = Number(req.headers['content-length']);
    if (!Number.isFinite(length) || length <= 0)
      throw new PayloadTooLargeException('Send the form from the website.');
    if (length > MAX_REQUEST_BYTES)
      throw new PayloadTooLargeException(
        'The files are too big together. Send fewer or smaller photos.',
      );
    return true;
  }
}

@Controller('onboarding')
@UseGuards(OnboardingOpenGuard)
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
