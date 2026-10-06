import {
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
import { randomUUID } from 'node:crypto';
import { hashToken, isGraceReplay } from './refresh-policy';
import { Session, SessionDocument } from 'src/schemas/session.schema';
import {
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
} from 'lib/constants/authConstants';

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

interface RefreshPayload {
  sub: string;
  sid: string;
  tv: number;
  jti: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 11000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly dummyHash = bcrypt.hashSync(randomUUID(), 12);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
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

    const hashed = await bcrypt.hash(password, 12);

    try {
      await this.userModel.create({
        firstName,
        lastName,
        username,
        email,
        password: hashed,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('User already exists');
      }
      this.logger.error(error);
      throw new InternalServerErrorException(
        'Failed to register user due to a server error',
      );
    }
  }

  async login(
    loginDto: LoginUserDto,
    meta: RequestMeta,
  ): Promise<Required<AuthTokens>> {
    try {
      const identifier = loginDto.identifier.trim();

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

      if (!user || !match)
        throw new UnauthorizedException('Invalid credentials');

      if (!user.isActive) throw new ForbiddenException('Account is disabled');

      await this.userModel.updateOne(
        { _id: user._id },
        { $set: { lastLoginAt: new Date() } },
      );

      return this.createSession(user, meta);
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(error);
      throw new InternalServerErrorException(
        'Failed to login user due to a server error',
      );
    }
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
        accessToken: await this.signAccessToken(payload.sub),
        refreshToken: nextRefreshToken,
      };
    }

    const session = await this.sessionModel.findOne({
      _id: payload.sid,
      userId: user._id,
    });
    if (!session) throw new UnauthorizedException('Session expired');

    if (isGraceReplay(session, presentedHash)) {
      return { accessToken: await this.signAccessToken(payload.sub) };
    }

    await this.revokeAllSessions(user._id);
    this.logger.warn(
      `Refresh token reuse detected for user ${payload.sub}: all sessions revoked`,
    );
    throw new UnauthorizedException('Invalid refresh token');
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = await this.jwtService.verifyAsync<RefreshPayload>(
        refreshToken,
        {
          secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
          ignoreExpiration: true,
        },
      );
      await this.sessionModel.deleteOne({
        _id: payload.sid,
        userId: payload.sub,
      });
    } catch (error) {
      this.logger.warn(`Logout could not remove the session: ${String(error)}`);
    }
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

    return { accessToken: await this.signAccessToken(userId), refreshToken };
  }

  private async revokeAllSessions(userId: Types.ObjectId) {
    await Promise.all([
      this.sessionModel.deleteMany({ userId }),
      this.userModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } }),
    ]);
  }

  private signAccessToken(userId: string) {
    return this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: ACCESS_TTL_SECONDS,
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
    });
  }
}
