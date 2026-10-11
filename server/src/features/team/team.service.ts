import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  isValidObjectId,
  type Model,
  type PipelineStage,
  Types,
} from 'mongoose';
import { ROLE_RANK, ROLES, type Role } from 'lib/constants/roles';
import { paginationMeta, pageOffset, type Paginated } from 'lib/pagination';
import { allTermsMatch, searchTerms } from 'lib/search';
import { Session, type SessionDocument } from 'src/schemas/session.schema';
import { User, type UserDocument } from 'src/schemas/user.schema';
import { TEAM_ROLES, type ListTeamQuery } from './dto/team.dto';

export const TEAM_PAGE_SIZE = 20;
const CANDIDATE_LIMIT = 8;
const SEARCH_FIELDS = ['firstName', 'lastName', 'email'] as const;

export type Actor = { id: string; role: Role };

export type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  isYou: boolean;
  can: { roles: Role[]; changeStatus: boolean };
  lockedReason?: string;
};

export type TeamList = Paginated<TeamMember> & {
  totals: {
    all: number;
    admin: number;
    manager: number;
    staff: number;
    disabled: number;
  };
};

export type TeamCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
};

type UserRow = {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  isEmailVerified?: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
};

const PUBLIC_FIELDS = {
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

export function teamRights(
  actor: Actor,
  target: Pick<UserRow, '_id' | 'role'>,
): Pick<TeamMember, 'can' | 'lockedReason'> {
  const none = (lockedReason: string) => ({
    can: { roles: [], changeStatus: false },
    lockedReason,
  });
  if (String(target._id) === actor.id)
    return none("That's you. Another admin can change your account.");

  const mine = ROLE_RANK[actor.role] ?? 0;
  const theirs = ROLE_RANK[target.role] ?? 0;
  if (theirs > mine || (theirs === mine && actor.role !== 'admin'))
    return none('Their role is as high as yours.');

  return {
    can: {
      roles: ROLES.filter((r) => r !== target.role && ROLE_RANK[r] <= mine),
      changeStatus: true,
    },
  };
}

@Injectable()
export class TeamService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  async list(query: ListTeamQuery, actor: Actor): Promise<TeamList> {
    const team = { role: { $in: [...TEAM_ROLES] } };
    const terms = searchTerms(query.search);
    const match: Record<string, unknown> = {
      ...team,
      ...(query.role && { role: query.role }),
      ...(query.status && { isActive: query.status === 'active' }),
      ...(terms.length && allTermsMatch(terms, SEARCH_FIELDS)),
    };

    const pipeline: PipelineStage[] = [
      { $match: match },
      { $addFields: { rank: { $indexOfArray: [[...ROLES], '$role'] } } },
      { $sort: { rank: -1, firstName: 1, lastName: 1, _id: 1 } },
      {
        $facet: {
          items: [
            { $skip: pageOffset(query.page, TEAM_PAGE_SIZE) },
            { $limit: TEAM_PAGE_SIZE },
            { $project: PUBLIC_FIELDS },
          ],
          total: [{ $count: 'n' }],
        },
      },
    ];

    const [[page], counts] = await Promise.all([
      this.userModel.aggregate<{ items: UserRow[]; total: { n: number }[] }>(
        pipeline,
      ),
      this.userModel.aggregate<{ _id: Role; n: number; disabled: number }>([
        { $match: team },
        {
          $group: {
            _id: '$role',
            n: { $sum: 1 },
            disabled: { $sum: { $cond: ['$isActive', 0, 1] } },
          },
        },
      ]),
    ]);

    const count = (role: Role) => counts.find((c) => c._id === role)?.n ?? 0;
    const total = page?.total[0]?.n ?? 0;
    return {
      items: (page?.items ?? []).map((row) => this.toMember(row, actor)),
      meta: paginationMeta(query.page, TEAM_PAGE_SIZE, total),
      totals: {
        all: counts.reduce((sum, c) => sum + c.n, 0),
        admin: count('admin'),
        manager: count('manager'),
        staff: count('staff'),
        disabled: counts.reduce((sum, c) => sum + c.disabled, 0),
      },
    };
  }

  async candidates(search: string): Promise<TeamCandidate[]> {
    const terms = searchTerms(search);
    if (search.trim().length < 2 || terms.length === 0) return [];
    const rows = await this.userModel
      .find(
        {
          role: 'customer',
          isActive: true,
          ...allTermsMatch(terms, SEARCH_FIELDS),
        },
        { firstName: 1, lastName: 1, email: 1, createdAt: 1 },
      )
      .sort({ firstName: 1, lastName: 1 })
      .limit(CANDIDATE_LIMIT)
      .lean<UserRow[]>();
    return rows.map((r) => ({
      id: String(r._id),
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      createdAt: r.createdAt,
    }));
  }

  async changeRole(
    id: string,
    role: Role,
    from: Role | undefined,
    actor: Actor,
  ): Promise<TeamMember> {
    const target = await this.findTarget(id);
    if (from && from !== target.role) throw changedMeanwhile(target);
    if (target.role === role) return this.toMember(target, actor);

    const rights = teamRights(actor, target);
    if (rights.lockedReason) throw new ForbiddenException(rights.lockedReason);
    if (!rights.can.roles.includes(role))
      throw new ForbiddenException(
        "You can't give a role higher than your own.",
      );

    const losesAdmin = target.role === 'admin' && target.isActive;
    if (losesAdmin) await this.assertAnotherAdmin(target._id);

    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: target._id, role: target.role },
        { $set: { role } },
        { new: true, projection: PUBLIC_FIELDS },
      )
      .lean<UserRow>();
    if (!updated) throw changedMeanwhile(target);

    if (losesAdmin && !(await this.hasActiveAdmin())) {
      await this.userModel.updateOne(
        { _id: target._id },
        { $set: { role: target.role } },
      );
      throw lastAdmin();
    }
    return this.toMember(updated, actor);
  }

  async changeStatus(
    id: string,
    isActive: boolean,
    actor: Actor,
  ): Promise<TeamMember> {
    const target = await this.findTarget(id);
    if (target.isActive === isActive) return this.toMember(target, actor);

    const rights = teamRights(actor, target);
    if (rights.lockedReason) throw new ForbiddenException(rights.lockedReason);

    const losesAdmin = !isActive && target.role === 'admin';
    if (losesAdmin) await this.assertAnotherAdmin(target._id);

    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: target._id },
        isActive
          ? { $set: { isActive } }
          : { $set: { isActive }, $inc: { tokenVersion: 1 } },
        { new: true, projection: PUBLIC_FIELDS },
      )
      .lean<UserRow>();
    if (!updated) throw new NotFoundException('This account no longer exists');

    if (losesAdmin && !(await this.hasActiveAdmin())) {
      await this.userModel.updateOne(
        { _id: target._id },
        { $set: { isActive: true } },
      );
      throw lastAdmin();
    }
    if (!isActive) await this.sessionModel.deleteMany({ userId: target._id });

    return this.toMember(updated, actor);
  }

  private async findTarget(id: string): Promise<UserRow> {
    if (!isValidObjectId(id))
      throw new NotFoundException('This account no longer exists');
    const row = await this.userModel
      .findById(id, PUBLIC_FIELDS)
      .lean<UserRow>();
    if (!row) throw new NotFoundException('This account no longer exists');
    return row;
  }

  private async hasActiveAdmin(): Promise<boolean> {
    return !!(await this.userModel.exists({ role: 'admin', isActive: true }));
  }

  private async assertAnotherAdmin(except: Types.ObjectId): Promise<void> {
    const other = await this.userModel.exists({
      _id: { $ne: except },
      role: 'admin',
      isActive: true,
    });
    if (!other) throw lastAdmin();
  }

  private toMember(row: UserRow, actor: Actor): TeamMember {
    return {
      id: String(row._id),
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone || undefined,
      role: row.role,
      isActive: row.isActive !== false,
      isEmailVerified: row.isEmailVerified === true,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      isYou: String(row._id) === actor.id,
      ...teamRights(actor, row),
    };
  }
}

const lastAdmin = () =>
  new ConflictException(
    'The restaurant needs at least one active admin. Make someone else admin first.',
  );

const changedMeanwhile = (target: UserRow) =>
  new ConflictException(
    `${target.firstName}'s role was changed by someone else in the meantime. Refresh and try again.`,
  );
