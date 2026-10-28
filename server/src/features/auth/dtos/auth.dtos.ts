import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  readonly identifier!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  readonly password!: string;
}

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @Matches(/^[A-Za-zÀ-ÿ '-]+$/, {
    message: 'First name must contain only letters',
  })
  @MinLength(2, { message: 'First name is too short' })
  @MaxLength(30, { message: 'First name is too long' })
  readonly firstName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @Matches(/^[A-Za-zÀ-ÿ '-]+$/, {
    message: 'Last name must contain only letters',
  })
  @MinLength(2, { message: 'Last name is too short' })
  @MaxLength(30, { message: 'Last name is too long' })
  readonly lastName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(5, { message: 'Username is too short' })
  @MaxLength(30, { message: 'Username is too long' })
  @Matches(/^[^\s@]+$/, {
    message: 'Username can’t contain spaces or @',
  })
  readonly username!: string;

  @IsString()
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email address' })
  @MaxLength(254)
  readonly email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password is too long' })
  @Matches(/(?=.*[a-z])/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/(?=.*\d)/, {
    message: 'Password must contain at least one number',
  })
  @Matches(/(?=.*[@$!%*?&])/, {
    message: 'Password must contain at least one special character',
  })
  readonly password!: string;
}

export class GoogleLoginDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2048)
  code!: string;
}

export class ForgotPasswordDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email!: string;
}

export class CheckResetTokenDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{40,64}$/, { message: 'Invalid link' })
  token!: string;
}

export class ResetPasswordDto extends CheckResetTokenDto {
  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters' })
  @MaxLength(128)
  password!: string;
}

export class TwoFactorChallengeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{30,64}$/, {
    message: 'This sign-in timed out. Please sign in again.',
  })
  challenge!: string;
}

export class TwoFactorVerifyDto extends TwoFactorChallengeDto {
  @IsString()
  @MinLength(6, { message: 'Enter the 6-digit code' })
  @MaxLength(32)
  code!: string;

  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}
