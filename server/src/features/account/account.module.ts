import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  EmailVerification,
  EmailVerificationSchema,
} from 'src/schemas/email-verification.schema';
import { Session, SessionSchema } from 'src/schemas/session.schema';
import { User, UserSchema } from 'src/schemas/user.schema';
import {
  AccountController,
  EmailVerificationController,
} from './account.controller';
import { AccountService } from './account.service';
import { EmailVerificationService } from './email-verification.service';
import { TwoFactorModule } from '../two-factor/two-factor.module';

@Module({
  imports: [
    TwoFactorModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: EmailVerification.name, schema: EmailVerificationSchema },
    ]),
  ],
  controllers: [AccountController, EmailVerificationController],
  providers: [AccountService, EmailVerificationService],
  exports: [EmailVerificationService],
})
export class AccountModule {}
