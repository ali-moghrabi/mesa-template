import {
  ForbiddenException,
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
};

type AccountRow = {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
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
  ) {}

  async get(userId: string): Promise<Account> {
    const account = toAccount(await this.withPassword(userId));
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

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userModel.updateOne(
      { _id: row._id },
      { $set: { [PASSWORD_FIELD]: hash } },
    );
    return { ok: true };
  }

  async signOutEverywhere(userId: string): Promise<{ ok: true }> {
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
