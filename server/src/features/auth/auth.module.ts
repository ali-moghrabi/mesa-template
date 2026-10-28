import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from 'src/strategies/jwt.strategy';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/schemas/user.schema';
import { Session, SessionSchema } from 'src/schemas/session.schema';
import {
  PasswordReset,
  PasswordResetSchema,
} from 'src/schemas/password-reset.schema';
import {
  LoginAttempt,
  LoginAttemptSchema,
} from 'src/schemas/login-attempt.schema';
import { AccountModule } from '../account/account.module';
import { LoginAttemptsService } from './login-attempts.service';
import { TwoFactorModule } from '../two-factor/two-factor.module';

@Module({
  imports: [
    PassportModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: PasswordReset.name, schema: PasswordResetSchema },
      { name: LoginAttempt.name, schema: LoginAttemptSchema },
    ]),
    JwtModule.register({}),
    AccountModule,
    TwoFactorModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordResetService,
    LoginAttemptsService,
    JwtStrategy,
  ],
  exports: [AuthService, LoginAttemptsService],
})
export class AuthModule {}
