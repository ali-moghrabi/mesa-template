import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { isEmail } from 'class-validator';
import { RegisterUserDto, LoginUserDto } from './dtos/auth.dtos';
import { User, UserDocument } from 'src/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import type { Env } from 'src/config/env';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID } from 'node:crypto';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { hashToken, isGraceReplay } from './refresh-policy';
import { Session, SessionDocument } from 'src/schemas/session.schema';
import {
  ACCESS_TTL_SECONDS,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  REFRESH_TTL_SECONDS,
} from 'lib/constants/authConstants';
import { EmailVerificationService } from 'src/features/account/email-verification.service';
import { passwordProblem } from 'lib/security/password-policy';
import { LoginAttemptsService } from './login-attempts.service';
import {
  TwoFactorService,
  type SetupInfo,
  type TwoFactorGate,
} from 'src/features/two-factor/two-factor.service';

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export type SignInResult =
  { tokens: Required<AuthTokens> } | { twoFactor: TwoFactorGate };

interface RefreshPayload {
  sub: string;
  sid: string;
  tv: number;
  jti: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const usernameBase = (email: string) =>
  email
    .split('@')[0]
    .toLowerCase()
    .replace(/\+.*$/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20) || 'guest';

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 11000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly dummyHash = bcrypt.hashSync(randomUUID(), 12);
  private googleClient?: OAuth2Client;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly emailVerification: EmailVerificationService,
    private readonly loginAttempts: LoginAttemptsService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async registerNewUser(registerUserDto: RegisterUserDto) {
    const { firstName, lastName, password } = registerUserDto;
    const email = normalizeEmail(registerUserDto.email);
    const username = registerUserDto.username.toLowerCase();

    const userExists = await this.userModel.exists({
      $or: [{ email }, { username }],
    });

    if (userExists) {
      throw new ConflictException('Email or username already exists');
    }

    const weak = await passwordProblem(password, {
      email,
      username,
      firstName,
      lastName,
    });
    if (weak) throw new BadRequestException(weak);

    const hashed = await bcrypt.hash(password, 12);

    let userId: Types.ObjectId;
    try {
      const user = await this.userModel.create({
        firstName,
        lastName,
        username,
        email,
        password: hashed,
      });
      userId = user._id;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('User already exists');
      }
      this.logger.error(error);
      throw new InternalServerErrorException(
        'Failed to register user due to a server error',
      );
    }

    this.emailVerification
      .send(userId)
      .catch((error: unknown) =>
        this.logger.warn(
          `Verification email after sign-up failed: ${(error as Error).message}`,
        ),
      );
  }

  async login(
    loginDto: LoginUserDto,
    meta: RequestMeta,
    trustedDevice?: string,
  ): Promise<SignInResult> {
    try {
      const identifier = loginDto.identifier.trim();
      await this.loginAttempts.assertNotLocked(identifier);

      const user = await this.userModel
        .findOne(
          isEmail(identifier)
            ? { email: normalizeEmail(identifier) }
            : { username: identifier.toLowerCase() },
        )
        .select('+password +tokenVersion');

      const match = await bcrypt.compare(
        loginDto.password,
        user?.password ?? this.dummyHash,
      );

      if (!user || !match) {
        await this.loginAttempts.recordFailure(identifier);
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.isActive) throw new ForbiddenException('Account is disabled');

      await this.loginAttempts.clear(identifier);
      return this.afterFirstStep(user, meta, trustedDevice);
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(error);
      throw new InternalServerErrorException(
        'Failed to login user due to a server error',
      );
    }
  }

  async loginWithGoogle(
    code: string,
    meta: RequestMeta,
    trustedDevice?: string,
  ): Promise<SignInResult> {
    const profile = await this.googleProfile(code);
    const email = normalizeEmail(profile.email ?? '');

    if (!email || profile.email_verified !== true) {
      throw new UnauthorizedException(
        'Your Google account has no verified email address',
      );
    }

    try {
      const user = await this.findOrCreateGoogleUser(
        profile.sub,
        email,
        profile,
      );

      if (!user.isActive) throw new ForbiddenException('Account is disabled');

      return this.afterFirstStep(user, meta, trustedDevice);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error);
      throw new InternalServerErrorException(
        'Failed to sign in with Google due to a server error',
      );
    }
  }

  private async findOrCreateGoogleUser(
    googleId: string,
    email: string,
    profile: TokenPayload,
  ): Promise<UserDocument> {
    const linked = await this.userModel
      .findOne({ googleId })
      .select('+tokenVersion +googleId');
    if (linked) return linked;

    const existing = await this.userModel
      .findOne({ email })
      .select('+tokenVersion +googleId');
    if (!existing) return this.createGoogleUser(profile, email);

    if (existing.googleId && existing.googleId !== googleId) {
      throw new ConflictException(
        'This email is already linked to another Google account',
      );
    }

    // Google proves this person owns the email. If the account's email was never verified,
    // whoever made it may not be them: someone can sign up with another person's address and
    // wait for them to arrive with Google. So that password and its sessions are dropped, and
    // only the real owner (through Google) keeps access.
    const unverified = !existing.isEmailVerified;
    await this.userModel.updateOne(
      { _id: existing._id },
      {
        $set: {
          googleId,
          isEmailVerified: true,
          ...(!existing.emailVerifiedAt && { emailVerifiedAt: new Date() }),
        },
        ...(unverified && {
          $unset: { password: 1 },
          $inc: { tokenVersion: 1 },
        }),
      },
    );
    if (unverified)
      await this.sessionModel.deleteMany({ userId: existing._id });
    this.logger.log(
      `Google linked to existing account ${String(existing._id)}${unverified ? ' (unverified email: password removed, sessions ended)' : ''}`,
    );
    const fresh = await this.userModel
      .findById(existing._id)
      .select('+tokenVersion +googleId');
    if (!fresh) throw new UnauthorizedException('Please try again');
    return fresh;
  }

  private async googleProfile(code: string): Promise<TokenPayload> {
    const clientId = this.config.get('GOOGLE_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('GOOGLE_CLIENT_SECRET', {
      infer: true,
    });
    if (!clientId || !clientSecret) {
      this.logger.error(
        'Google sign-in: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set',
      );
      throw new InternalServerErrorException(
        'Google sign-in is not set up yet',
      );
    }

    this.googleClient ??= new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri: 'postmessage',
    });

    let idToken: string | null | undefined;
    try {
      const { tokens } = await this.googleClient.getToken(code);
      idToken = tokens.id_token;
    } catch (error) {
      this.logger.warn(
        `Google sign-in: code exchange failed (${(error as Error).message})`,
      );
      throw new UnauthorizedException(
        'Google sign-in expired. Please try again.',
      );
    }
    if (!idToken)
      throw new UnauthorizedException(
        'Google sign-in failed. Please try again.',
      );

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('No subject');
      return payload;
    } catch {
      throw new UnauthorizedException(
        'Google sign-in failed. Please try again.',
      );
    }
  }

  private async createGoogleUser(
    profile: TokenPayload,
    email: string,
  ): Promise<UserDocument> {
    const firstName = (
      profile.given_name ||
      profile.name?.split(' ')[0] ||
      email.split('@')[0]
    )
      .trim()
      .slice(0, 50);
    const lastName = (
      profile.family_name ||
      profile.name?.split(' ').slice(1).join(' ') ||
      '-'
    )
      .trim()
      .slice(0, 50);
    const base = usernameBase(email);

    for (let attempt = 0; attempt < 6; attempt++) {
      const username =
        attempt === 0 ? base : `${base}${randomInt(1000, 99999)}`;
      if (await this.userModel.exists({ username })) continue;
      try {
        return await this.userModel.create({
          firstName,
          lastName,
          username,
          email,
          googleId: profile.sub,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        const existing = await this.userModel
          .findOne({ email })
          .select('+tokenVersion +googleId');
        if (existing) return existing;
      }
    }
    throw new InternalServerErrorException(
      'Could not create your account. Please try again.',
    );
  }

  async refresh(
    refreshToken: string | undefined,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    void meta;
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(
        refreshToken,
        {
          secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
          algorithms: [JWT_ALGORITHM],
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select('+tokenVersion');
    if (!user || !user.isActive || (user.tokenVersion ?? 0) !== payload.tv) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const presentedHash = hashToken(refreshToken);
    const nextRefreshToken = await this.signRefreshToken(
      payload.sub,
      payload.sid,
      payload.tv,
    );

    const rotated = await this.sessionModel.findOneAndUpdate(
      { _id: payload.sid, userId: user._id, tokenHash: presentedHash },
      {
        $set: {
          tokenHash: hashToken(nextRefreshToken),
          previousTokenHash: presentedHash,
          rotatedAt: new Date(),
          expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
        },
      },
    );

    if (rotated) {
      return {
        accessToken: await this.signAccessToken(
          payload.sub,
          payload.sid,
          payload.tv,
        ),
        refreshToken: nextRefreshToken,
      };
    }

    const session = await this.sessionModel.findOne({
      _id: payload.sid,
      userId: user._id,
    });
    if (!session) throw new UnauthorizedException('Session expired');

    if (isGraceReplay(session, presentedHash)) {
      return {
        accessToken: await this.signAccessToken(
          payload.sub,
          payload.sid,
          payload.tv,
        ),
      };
    }

    await this.revokeAllSessions(user._id);
    this.logger.warn(
      `Refresh token reuse detected for user ${payload.sub}: all sessions revoked`,
    );
    throw new UnauthorizedException('Invalid refresh token');
  }

  async logout(refreshTokens: string[]): Promise<void> {
    if (refreshTokens.length === 0) {
      this.logger.warn('Logout without a refresh cookie: no session deleted');
      return;
    }

    for (const refreshToken of refreshTokens) {
      try {
        const payload = await this.jwtService.verifyAsync<RefreshPayload>(
          refreshToken,
          {
            secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
            algorithms: [JWT_ALGORITHM],
            ignoreExpiration: true,
          },
        );
        if (!Types.ObjectId.isValid(payload.sid)) continue;

        const session = await this.sessionModel.findById(payload.sid).lean();
        if (!session || String(session.userId) !== payload.sub) continue;

        await this.sessionModel.deleteOne({ _id: session._id });
        this.logger.log(`Logout: deleted session ${payload.sid}`);
      } catch {
        this.logger.error(`Logout: failed to delete session!`);
      }
    }
  }

  private async afterFirstStep(
    user: UserDocument,
    meta: RequestMeta,
    trustedDevice?: string,
  ): Promise<SignInResult> {
    const gate = await this.twoFactor.gate(user, trustedDevice);
    if (gate) return { twoFactor: gate };
    return { tokens: await this.finishSignIn(user, meta) };
  }

  private async finishSignIn(
    user: UserDocument,
    meta: RequestMeta,
  ): Promise<Required<AuthTokens>> {
    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } },
    );
    return this.createSession(user, meta);
  }

  startTwoFactorSetup(challenge: string): Promise<SetupInfo> {
    return this.twoFactor.challengeSetup(challenge);
  }

  async completeTwoFactor(
    challenge: string,
    code: string,
    trust: boolean,
    meta: RequestMeta,
  ): Promise<{
    tokens: Required<AuthTokens>;
    recoveryCodes?: string[];
    trustedToken?: string;
  }> {
    const done = await this.twoFactor.completeChallenge(
      challenge,
      code,
      trust,
      meta,
    );
    const user = await this.userModel
      .findById(done.userId)
      .select('+tokenVersion');
    if (!user || !user.isActive)
      throw new UnauthorizedException('This account is disabled');
    return {
      tokens: await this.finishSignIn(user, meta),
      recoveryCodes: done.recoveryCodes,
      trustedToken: done.trustedToken,
    };
  }

  private async createSession(
    user: UserDocument,
    meta: RequestMeta,
  ): Promise<Required<AuthTokens>> {
    const userId = String(user._id);
    const sessionId = new Types.ObjectId();
    const refreshToken = await this.signRefreshToken(
      userId,
      sessionId.toString(),
      user.tokenVersion ?? 0,
    );

    await this.sessionModel.create({
      _id: sessionId,
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      userAgent: meta.userAgent?.slice(0, 300),
      ip: meta.ip,
    });

    return {
      accessToken: await this.signAccessToken(
        userId,
        sessionId.toString(),
        user.tokenVersion ?? 0,
      ),
      refreshToken,
    };
  }

  private async revokeAllSessions(userId: Types.ObjectId) {
    await Promise.all([
      this.sessionModel.deleteMany({ userId }),
      this.userModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } }),
      this.twoFactor.forgetDevices(userId),
    ]);
  }

  private signAccessToken(
    userId: string,
    sessionId: string,
    tokenVersion: number,
  ) {
    return this.jwtService.signAsync(
      { sub: userId, sid: sessionId, tv: tokenVersion },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: ACCESS_TTL_SECONDS,
        algorithm: JWT_ALGORITHM,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      },
    );
  }

  private signRefreshToken(
    userId: string,
    sessionId: string,
    tokenVersion: number,
  ) {
    const payload: RefreshPayload = {
      sub: userId,
      sid: sessionId,
      tv: tokenVersion,
      jti: randomUUID(),
    };
    return this.jwtService.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: REFRESH_TTL_SECONDS,
      algorithm: JWT_ALGORITHM,
    });
  }
}
