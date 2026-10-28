import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
);

export const NAME_MAX = 50;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,22}$/;

export class UpdateAccountDto {
  @trim
  @IsString()
  @MinLength(1, { message: 'Enter your first name' })
  @MaxLength(NAME_MAX)
  firstName!: string;

  @trim
  @IsString()
  @MinLength(1, { message: 'Enter your last name' })
  @MaxLength(NAME_MAX)
  lastName!: string;

  @IsOptional()
  @trim
  @IsString()
  @Matches(/^$|^\+?[0-9][0-9 ()-]{5,22}$/, {
    message: 'Enter a valid phone number',
  })
  phone?: string;
}

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_MAX)
  currentPassword?: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `Use at least ${PASSWORD_MIN} characters`,
  })
  @MaxLength(PASSWORD_MAX)
  newPassword!: string;
}

export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_MAX)
  password?: string;
}

export const VERIFY_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export class VerifyTokenDto {
  @IsString()
  @Matches(VERIFY_TOKEN_PATTERN, { message: 'This link is not valid.' })
  token!: string;
}

export class TwoFactorCodeDto {
  @IsString()
  @MinLength(6, { message: 'Enter the 6-digit code' })
  @MaxLength(32)
  code!: string;
}

export class StartTwoFactorDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;
}

export class DisableTwoFactorDto extends TwoFactorCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_MAX)
  password?: string;
}
