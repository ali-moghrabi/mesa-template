import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { Types, type Model } from 'mongoose';
import type { Role } from 'lib/constants/roles';
import { mfaRequiredFor } from 'lib/security/mfa-policy';
import { seal, unseal } from 'lib/security/secret-box';
import {
  cleanTotp,
  newTotpSecret,
  otpauthUri,
  verifyTotp,
} from 'lib/security/totp';
import { User, type UserDocument } from 'src/schemas/user.schema';
import {
  MfaChallenge,
  type MfaChallengeDocument,
} from 'src/schemas/mfa-challenge.schema';
import {
  TrustedDevice,
  type TrustedDeviceDocument,
} from 'src/schemas/trusted-device.schema';

export const TRUSTED_DEVICE_COOKIE = 'MESA_TRUSTED_DEVICE';
export const TRUST_DAYS = 30;
const DAY_MS = 24 * 60 * 60_000;

const CHALLENGE_MS = 10 * 60_000;
const CHALLENGE_TRIES = 5;
const PENDING_MS = 15 * 60_000;
const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60_000;

const RECOVERY_COUNT = 10;
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export type TwoFactorState = {
  enabled: boolean;
  enabledAt?: Date;
  required: boolean;
  recoveryCodesLeft: number;
  trustedDevices: number;
};

export type SetupInfo = {
  secret: string;
  uri: string;
  issuer: string;
  account: string;
};

export type TwoFactorGate = {
  step: 'verify' | 'setup';
  challenge: string;
  expiresAt: Date;
};

export type RequestMeta = { userAgent?: string; ip?: string };

type MfaRow = {
  _id: Types.ObjectId;
  email: string;
  role: Role;
  isActive?: boolean;
  mfaEnabled?: boolean;
  mfaEnabledAt?: Date;
  mfaSecret?: string;
  mfaPendingSecret?: string;
  mfaPendingAt?: Date;
  mfaLastStep?: number;
  mfaRecoveryCodes?: string[];
  mfaLockedUntil?: Date;
  tokenVersion?: number;
};

const MFA_FIELDS =
  'email role isActive mfaEnabled mfaEnabledAt +mfaSecret +mfaPendingSecret +mfaPendingAt +mfaLastStep +mfaRecoveryCodes +mfaLockedUntil +tokenVersion';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');
const normalizeRecovery = (code: string) =>
  code.toLowerCase().replace(/[^a-z0-9]/g, '');

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(MfaChallenge.name)
    private readonly challengeModel: Model<MfaChallengeDocument>,
    @InjectModel(TrustedDevice.name)
    private readonly deviceModel: Model<TrustedDeviceDocument>,
  ) {}

  async state(userId: string | Types.ObjectId): Promise<TwoFactorState> {
    const user = await this.row(userId);
    const trustedDevices = user.mfaEnabled
      ? await this.deviceModel.countDocuments({
          userId: user._id,
          expiresAt: { $gt: new Date() },
        })
      : 0;
    return {
      enabled: user.mfaEnabled === true,
      enabledAt: user.mfaEnabledAt,
      required: mfaRequiredFor(user.role),
      recoveryCodesLeft: user.mfaRecoveryCodes?.length ?? 0,
      trustedDevices,
    };
  }

  async gate(
    user: {
      _id: Types.ObjectId;
      role: Role;
      mfaEnabled?: boolean;
      tokenVersion?: number;
    },
    trustedToken: string | undefined,
  ): Promise<TwoFactorGate | null> {
    const tv = user.tokenVersion ?? 0;
    if (user.mfaEnabled) {
      if (await this.isTrusted(user._id, trustedToken)) return null;
      return this.newChallenge(user._id, 'verify', tv);
    }
    if (mfaRequiredFor(user.role))
      return this.newChallenge(user._id, 'setup', tv);
    return null;
  }

  async challengeSetup(token: string): Promise<SetupInfo> {
    const challenge = await this.findChallenge(token);
    if (challenge.purpose !== 'setup')
      throw new BadRequestException('Two-step sign-in is already set up.');
    const user = await this.row(challenge.userId);
    await this.assertCurrent(challenge, user);

    let secret: string;
    if (challenge.pendingSecret) secret = unseal(challenge.pendingSecret);
    else {
      secret = newTotpSecret();
      await this.challengeModel.updateOne(
        { _id: challenge._id },
        { $set: { pendingSecret: seal(secret) } },
      );
    }
    return this.setupInfo(secret, user.email);
  }

  async completeChallenge(
    token: string,
    code: string,
    trust: boolean,
    meta: RequestMeta,
  ): Promise<{
    userId: Types.ObjectId;
    recoveryCodes?: string[];
    trustedToken?: string;
  }> {
    const challenge = await this.findChallenge(token);
    const user = await this.row(challenge.userId);
    if (user.isActive === false)
      throw new UnauthorizedException('This account is disabled');
    await this.assertCurrent(challenge, user);
    this.assertNotLocked(user);

    const counted = await this.challengeModel.findOneAndUpdate(
      { _id: challenge._id, attempts: { $lt: CHALLENGE_TRIES } },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    );
    if (!counted) {
      await this.challengeModel.deleteOne({ _id: challenge._id });
      throw new UnauthorizedException(
        'Too many wrong codes. Please sign in again.',
      );
    }

    let recoveryCodes: string[] | undefined;
    if (challenge.purpose === 'setup' && !user.mfaEnabled) {
      if (!challenge.pendingSecret)
        throw new BadRequestException('Scan the QR code first.');
      const secret = unseal(challenge.pendingSecret);
      const step = verifyTotp(secret, code);
      if (step === null) await this.wrongCode(user, counted.attempts);
      recoveryCodes = await this.turnOn(user._id, secret, step!);
    } else if (!(await this.useCode(user, code))) {
      await this.wrongCode(user, counted.attempts);
    }

    await this.challengeModel.deleteOne({ _id: challenge._id });
    const trustedToken = trust
      ? await this.trustDevice(user._id, meta)
      : undefined;
    return { userId: user._id, recoveryCodes, trustedToken };
  }

  /* ───────────── from the account page ───────────── */

  /**
   * Starts setting up (or moving to a new phone). When it's already on, a current code or a
   * backup code is needed first, so a stolen session can't swap in the attacker's phone.
   */
  async beginSetup(
    userId: string,
    currentCode: string | undefined,
  ): Promise<SetupInfo> {
    const user = await this.row(userId);
    if (user.mfaEnabled) await this.requireCode(user, currentCode);
    const secret = newTotpSecret();
    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { mfaPendingSecret: seal(secret), mfaPendingAt: new Date() } },
    );
    return this.setupInfo(secret, user.email);
  }

  /** Confirms the new app with its first code. Returns fresh backup codes. */
  async enable(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.row(userId);
    this.assertNotLocked(user);
    const fresh =
      user.mfaPendingSecret &&
      user.mfaPendingAt &&
      Date.now() - user.mfaPendingAt.getTime() < PENDING_MS;
    if (!fresh)
      throw new BadRequestException(
        'The setup timed out. Start again to get a new QR code.',
      );
    const secret = unseal(user.mfaPendingSecret!);
    const step = verifyTotp(secret, code);
    if (step === null) {
      await this.recordFailure(user._id);
      throw codeError(
        'That code isn’t right. Check the app shows this account, then try the newest code.',
      );
    }
    const recoveryCodes = await this.turnOn(user._id, secret, step);
    // a new phone: devices trusted with the old one must prove themselves again
    await this.deviceModel.deleteMany({ userId: user._id });
    return { recoveryCodes };
  }

  /** Turns it off (the caller checks the password). Not allowed when the role requires it. */
  async disable(userId: string, code: string): Promise<void> {
    const user = await this.row(userId);
    if (!user.mfaEnabled) return;
    if (mfaRequiredFor(user.role))
      throw new ConflictException(
        'Your role needs two-step sign-in, so it stays on. To use a new phone, choose “Move to a new phone”.',
      );
    await this.requireCode(user, code);
    await this.clear(user._id);
    this.logger.log(`Two-step sign-in turned off for ${String(user._id)}`);
  }

  async regenerateRecoveryCodes(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.row(userId);
    if (!user.mfaEnabled)
      throw new BadRequestException('Turn on two-step sign-in first.');
    await this.requireCode(user, code);
    const recoveryCodes = newRecoveryCodes();
    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { mfaRecoveryCodes: recoveryCodes.map(hashRecovery) } },
    );
    return { recoveryCodes };
  }

  /** Every trusted browser asks for a code again */
  async forgetDevices(userId: string | Types.ObjectId): Promise<void> {
    await this.deviceModel.deleteMany({ userId: new Types.ObjectId(userId) });
  }

  /**
   * Access was revoked (password reset or changed, signed out everywhere, a stolen refresh
   * token, account disabled): trusted browsers must show a code again, and any sign-in that
   * got past the password but not the code yet can't be finished any more.
   */
  async revokeAccess(userId: string | Types.ObjectId): Promise<void> {
    const id = new Types.ObjectId(userId);
    await Promise.all([
      this.deviceModel.deleteMany({ userId: id }),
      this.challengeModel.deleteMany({ userId: id }),
    ]);
  }

  /** An owner resets it for a team member who lost their phone (they set it up again) */
  async reset(userId: string | Types.ObjectId): Promise<void> {
    await this.clear(new Types.ObjectId(userId));
    this.logger.log(`Two-step sign-in reset for ${String(userId)}`);
  }

  /* ───────────── helpers ───────────── */

  private async clear(userId: Types.ObjectId) {
    await Promise.all([
      this.userModel.updateOne(
        { _id: userId },
        {
          $set: { mfaEnabled: false },
          $unset: {
            mfaEnabledAt: 1,
            mfaSecret: 1,
            mfaPendingSecret: 1,
            mfaPendingAt: 1,
            mfaLastStep: 1,
            mfaRecoveryCodes: 1,
            mfaFailures: 1,
            mfaLockedUntil: 1,
          },
        },
      ),
      this.deviceModel.deleteMany({ userId }),
      this.challengeModel.deleteMany({ userId }),
    ]);
  }

  private async turnOn(
    userId: Types.ObjectId,
    secret: string,
    step: number,
  ): Promise<string[]> {
    const recoveryCodes = newRecoveryCodes();
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          mfaEnabled: true,
          mfaEnabledAt: new Date(),
          mfaSecret: seal(secret),
          mfaLastStep: step,
          mfaRecoveryCodes: recoveryCodes.map(hashRecovery),
        },
        $unset: {
          mfaPendingSecret: 1,
          mfaPendingAt: 1,
          mfaFailures: 1,
          mfaLockedUntil: 1,
        },
      },
    );
    this.logger.log(`Two-step sign-in turned on for ${String(userId)}`);
    return recoveryCodes;
  }

  /**
   * Accepts an authenticator code or one backup code, and uses it up. Atomic: a code works
   * once, even if it's sent twice at the same moment.
   */
  private async useCode(user: MfaRow, input: string): Promise<boolean> {
    if (!user.mfaEnabled || !user.mfaSecret) return false;
    if (cleanTotp(input)) {
      const step = verifyTotp(
        unseal(user.mfaSecret),
        input,
        user.mfaLastStep ?? -1,
      );
      if (step === null) return false;
      const saved = await this.userModel.updateOne(
        {
          _id: user._id,
          $or: [
            { mfaLastStep: { $lt: step } },
            { mfaLastStep: { $exists: false } },
          ],
        },
        { $set: { mfaLastStep: step }, $unset: { mfaFailures: 1 } },
      );
      return saved.modifiedCount === 1;
    }
    const hash = hashRecovery(input);
    if (!normalizeRecovery(input)) return false;
    const used = await this.userModel.updateOne(
      { _id: user._id, mfaRecoveryCodes: hash },
      { $pull: { mfaRecoveryCodes: hash }, $unset: { mfaFailures: 1 } },
    );
    if (used.modifiedCount === 1)
      this.logger.log(`Backup code used by ${String(user._id)}`);
    return used.modifiedCount === 1;
  }

  /** For account changes: a valid code, or 400 */
  private async requireCode(user: MfaRow, code: string | undefined) {
    this.assertNotLocked(user);
    if (!code || !(await this.useCode(user, code))) {
      await this.recordFailure(user._id);
      throw codeError(
        'That code isn’t right. Use the newest code from your app, or a backup code.',
      );
    }
  }

  private async wrongCode(user: MfaRow, attempts: number): Promise<never> {
    await this.recordFailure(user._id);
    const left = CHALLENGE_TRIES - attempts;
    throw codeError(
      left > 0
        ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.`
        : 'That code isn’t right. Please sign in again.',
    );
  }

  private assertNotLocked(user: MfaRow) {
    const until = user.mfaLockedUntil?.getTime() ?? 0;
    if (until <= Date.now()) return;
    const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60_000));
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Too many wrong codes. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async recordFailure(userId: Types.ObjectId) {
    const after = await this.userModel
      .findOneAndUpdate(
        { _id: userId },
        { $inc: { mfaFailures: 1 } },
        { returnDocument: 'after', projection: { mfaFailures: 1 } },
      )
      .lean<{ mfaFailures?: number }>();
    if ((after?.mfaFailures ?? 0) < MAX_FAILURES) return;
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: { mfaLockedUntil: new Date(Date.now() + LOCK_MS) },
        $unset: { mfaFailures: 1 },
      },
    );
    this.logger.warn(
      `Two-step codes locked for ${String(userId)} after ${MAX_FAILURES} wrong codes`,
    );
  }

  private async newChallenge(
    userId: Types.ObjectId,
    purpose: 'verify' | 'setup',
    tokenVersion: number,
  ): Promise<TwoFactorGate> {
    const challenge = newToken();
    const expiresAt = new Date(Date.now() + CHALLENGE_MS);
    await this.challengeModel.create({
      userId,
      tokenHash: sha256(challenge),
      purpose,
      expiresAt,
      tokenVersion,
    });
    return { step: purpose, challenge, expiresAt };
  }

  private async assertCurrent(
    challenge: { _id: Types.ObjectId; tokenVersion?: number },
    user: MfaRow,
  ) {
    if ((challenge.tokenVersion ?? 0) === (user.tokenVersion ?? 0)) return;
    await this.challengeModel.deleteOne({ _id: challenge._id });
    throw new UnauthorizedException(
      'This sign-in timed out. Please sign in again.',
    );
  }

  private async findChallenge(token: string) {
    const challenge =
      typeof token === 'string' && /^[A-Za-z0-9_-]{30,64}$/.test(token)
        ? await this.challengeModel.findOne({
            tokenHash: sha256(token),
            expiresAt: { $gt: new Date() },
          })
        : null;
    if (!challenge)
      throw new UnauthorizedException(
        'This sign-in timed out. Please sign in again.',
      );
    return challenge;
  }

  private async isTrusted(
    userId: Types.ObjectId,
    token: string | undefined,
  ): Promise<boolean> {
    if (!token || !/^[A-Za-z0-9_-]{30,64}$/.test(token)) return false;
    const device = await this.deviceModel.findOneAndUpdate(
      { userId, tokenHash: sha256(token), expiresAt: { $gt: new Date() } },
      { $set: { lastUsedAt: new Date() } },
    );
    return !!device;
  }

  private async trustDevice(
    userId: Types.ObjectId,
    meta: RequestMeta,
  ): Promise<string> {
    const token = newToken();
    await this.deviceModel.create({
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TRUST_DAYS * DAY_MS),
      lastUsedAt: new Date(),
      userAgent: meta.userAgent?.slice(0, 300),
      ip: meta.ip?.slice(0, 64),
    });
    return token;
  }

  private setupInfo(secret: string, email: string): SetupInfo {
    const issuer = (
      process.env.MFA_ISSUER ||
      process.env.BRAND_NAME ||
      'MESA'
    ).trim();
    return {
      secret: secret.replace(/(.{4})/g, '$1 ').trim(),
      uri: otpauthUri(secret, issuer, email),
      issuer,
      account: email,
    };
  }

  private async row(userId: string | Types.ObjectId): Promise<MfaRow> {
    const user = Types.ObjectId.isValid(userId)
      ? await this.userModel.findById(userId).select(MFA_FIELDS).lean<MfaRow>()
      : null;
    if (!user) throw new NotFoundException('This account no longer exists');
    return user;
  }
}

function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_COUNT }, () => {
    let code = '';
    for (let i = 0; i < 10; i++)
      code += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}

const hashRecovery = (code: string) => sha256(normalizeRecovery(code));

const codeError = (message: string) =>
  new BadRequestException({
    statusCode: 400,
    message,
    errors: { code: message },
  });
