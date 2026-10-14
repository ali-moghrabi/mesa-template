import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

export const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
export const UNSUBSCRIBE_REASONS = [
  'too_many',
  'not_relevant',
  'never_signed_up',
  'other',
] as const;
export type UnsubscribeReason = (typeof UNSUBSCRIBE_REASONS)[number];

export class SubscribeDto {
  @trim
  @IsEmail({}, { message: 'Enter a valid email' })
  @MaxLength(120)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsIn(['website', 'footer', 'popup'])
  source?: 'website' | 'footer' | 'popup';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  page?: string;
}

export class TokenDto {
  @IsString()
  @Matches(TOKEN_PATTERN, { message: 'This link is not valid.' })
  token!: string;
}

export class UnsubscribeDto extends TokenDto {
  @IsOptional()
  @IsIn(UNSUBSCRIBE_REASONS)
  reason?: UnsubscribeReason;
}

export class TokenQuery extends TokenDto {
  @IsIn(['confirm', 'unsubscribe'])
  type!: 'confirm' | 'unsubscribe';
}
