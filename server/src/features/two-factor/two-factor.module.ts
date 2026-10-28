import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/schemas/user.schema';
import {
  MfaChallenge,
  MfaChallengeSchema,
} from 'src/schemas/mfa-challenge.schema';
import {
  TrustedDevice,
  TrustedDeviceSchema,
} from 'src/schemas/trusted-device.schema';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: MfaChallenge.name, schema: MfaChallengeSchema },
      { name: TrustedDevice.name, schema: TrustedDeviceSchema },
    ]),
  ],
  providers: [TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
