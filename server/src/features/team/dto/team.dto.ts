import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ROLES, type Role } from 'lib/constants/roles';

export const TEAM_ROLES = [
  'admin',
  'manager',
  'staff',
] as const satisfies readonly Role[];
export type TeamRole = (typeof TEAM_ROLES)[number];

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

export class ListTeamQuery {
  @IsOptional()
  @trim
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsIn(TEAM_ROLES)
  role?: TeamRole;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page: number = 1;
}

export class SearchCandidatesQuery {
  @trim
  @IsString()
  @MaxLength(80)
  search!: string;
}

export class ChangeRoleDto {
  @IsIn(ROLES)
  role!: Role;

  @IsOptional()
  @IsIn(ROLES)
  from?: Role;
}

export class ChangeStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
