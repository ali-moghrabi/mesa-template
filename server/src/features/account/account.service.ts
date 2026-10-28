import {
  ForbiddenException,
  Logger,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import type { Model, Types } from 'mongoose';
import type { Role } from 'lib/constants/roles';
import { formError } from 'lib/form-errors';
import { Session, type SessionDocument } from 'src/schemas/session.schema';
import { User, type UserDocument } from 'src/schemas/user.schema';
import type { UpdateAccountDto } from './dto/account.dto';
import { passwordProblem } from 'lib/security/password-policy';
import { MailService } from 'src/features/mail/mail.service';
import { passwordNoticeEmail } from 'src/features/mail/templates';
import {
  TwoFactorService,
  type SetupInfo,
  type TwoFactorState,
} from 'src/features/two-factor/two-factor.service';
import {
  EmailVerificationService,
  type VerificationState,
} from './email-verification.service';

const PASSWORD_FIELD = 'password';
const BCRYPT_ROUNDS = 12;
const checkPassword = (plain: string, hash: string | undefined) =>
  hash ? bcrypt.compare(plain, hash) : Promise.resolve(false);

export type Account = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  isEmailVerified: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  verification?: VerificationState;
  twoFactor?: TwoFactorState;
};

type AccountRow = {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
  phone?: string;
  role: Role;
  isActive?: boolean;
  isEmailVerified?: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  password?: string;
  googleId?: string;
};

const FIELDS = {
  firstName: 1,
  lastName: 1,
  email: 1,
  username: 1,
  phone: 1,
  role: 1,
  isActive: 1,
  isEmailVerified: 1,
  lastLoginAt: 1,
  createdAt: 1,
} as const;

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    private readonly verification: EmailVerificationService,
    private readonly twoFactor: TwoFactorService,
    private readonly mail: MailService,
  ) {}

  private readonly logger = new Logger(AccountService.name);

  async get(userId: string): Promise<Account> {
    const account = {
      ...toAccount(await this.withPassword(userId)),
      twoFactor: await this.twoFactor.state(userId),
    };
    if (account.isEmailVerified) return account;
    const verification = await this.verification.state(userId);
    return verification ? { ...account, verification } : account;
  }

  async update(userId: string, dto: UpdateAccountDto): Promise<Account> {
    const phone = dto.phone?.trim() ?? '';
    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: userId, isActive: { $ne: false } },
        phone
          ? {
              $set: { firstName: dto.firstName, lastName: dto.lastName, phone },
            }
          : {
              $set: { firstName: dto.firstName, lastName: dto.lastName },
              $unset: { phone: 1 },
            },
        {
          returnDocument: 'after',
          projection: { ...FIELDS, [PASSWORD_FIELD]: 1, googleId: 1 },
          runValidators: true,
        },
      )
      .lean<AccountRow>();
    if (!updated) throw new NotFoundException('This account no longer exists');
    return toAccount(updated);
  }

  async changePassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string,
    currentSessionId?: string,
  ): Promise<{ ok: true }> {
    const row = await this.withPassword(userId);
    if (
      row.password &&
      !(await checkPassword(currentPassword ?? '', row.password))
    )
      throw formError(
        { currentPassword: 'That isn’t your current password' },
        'Check your current password',
      );
    if (await checkPassword(newPassword, row.password))
      throw formError({
        newPassword: 'Choose a password you haven’t used here before',
      });
    const weak = await passwordProblem(newPassword, row);
    if (weak) throw formError({ newPassword: weak });

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userModel.updateOne(
      { _id: row._id },
      { $set: { [PASSWORD_FIELD]: hash } },
    );
    // Same as a reset, minus this device: other sessions end, trusted browsers must show a
    // code again, and a sign-in waiting for its code can't be finished
    await Promise.all([
      this.sessionModel.deleteMany({
        userId: row._id,
        ...(currentSessionId && { _id: { $ne: currentSessionId } }),
      }),
      this.twoFactor.revokeAccess(row._id),
    ]);
    this.notifyPasswordChange(row, row.password ? 'changed' : 'added');
    return { ok: true };
  }

  startTwoFactor(userId: string, code?: string): Promise<SetupInfo> {
    return this.twoFactor.beginSetup(userId, code);
  }

  enableTwoFactor(userId: string, code: string) {
    return this.twoFactor.enable(userId, code);
  }

  async disableTwoFactor(
    userId: string,
    code: string,
    password: string | undefined,
  ): Promise<{ ok: true }> {
    const row = await this.withPassword(userId);
    if (row.password && !(await checkPassword(password ?? '', row.password)))
      throw formError(
        { password: 'That isn’t your password' },
        'Check your password',
      );
    await this.twoFactor.disable(userId, code);
    return { ok: true };
  }

  newRecoveryCodes(userId: string, code: string) {
    return this.twoFactor.regenerateRecoveryCodes(userId, code);
  }

  async forgetTrustedDevices(userId: string): Promise<{ ok: true }> {
    await this.twoFactor.forgetDevices(userId);
    return { ok: true };
  }

  async signOutEverywhere(userId: string): Promise<{ ok: true }> {
    await this.twoFactor.revokeAccess(userId);
    await this.userModel.updateOne(
      { _id: userId },
      { $inc: { tokenVersion: 1 } },
    );
    await this.sessionModel.deleteMany({ userId });
    return { ok: true };
  }

  async remove(
    userId: string,
    password: string | undefined,
  ): Promise<{ ok: true }> {
    const row = await this.withPassword(userId);
    if (row.role !== 'customer')
      throw new ForbiddenException(
        'Team accounts are closed by an admin, from the Team page.',
      );
    if (row.password && !(await checkPassword(password ?? '', row.password)))
      throw formError(
        { password: 'That isn’t your password' },
        'Check your password',
      );

    await this.sessionModel.deleteMany({ userId: row._id });
    await this.userModel.deleteOne({ _id: row._id });
    return { ok: true };
  }

  /** An email to the account, so a password can't be added or changed quietly by a stranger */
  private notifyPasswordChange(
    row: { email: string; firstName: string },
    kind: 'added' | 'changed',
  ) {
    const brand = this.mail.brand();
    let at: string;
    try {
      at = `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: brand.timezone }).format(new Date())} (${brand.timezone})`;
    } catch {
      at = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' (UTC)';
    }
    void this.mail
      .send(
        row.email,
        passwordNoticeEmail(brand, {
          firstName: row.firstName,
          kind,
          at,
          resetLink: `${brand.webUrl}/forgot-password`,
        }),
      )
      .catch((error: unknown) =>
        this.logger.warn(`Password notice email failed: ${String(error)}`),
      );
  }

  private async withPassword(userId: string): Promise<AccountRow> {
    const row = await this.userModel
      .findById(userId, { ...FIELDS, [PASSWORD_FIELD]: 1, googleId: 1 })
      .lean<AccountRow>();
    if (!row || row.isActive === false)
      throw new NotFoundException('This account no longer exists');
    return {
      ...row,
      password: (row as Record<string, unknown>)[PASSWORD_FIELD] as
        string | undefined,
    };
  }
}

function toAccount(row: AccountRow): Account {
  return {
    id: String(row._id),
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone || undefined,
    role: row.role,
    isEmailVerified: row.isEmailVerified === true,
    hasPassword: !!row.password,
    googleLinked: !!row.googleId,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
}
