import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class LoginUserDto {
  @IsString()
  @IsNotEmpty()
  readonly identifier!: string;

  @IsString()
  @IsNotEmpty()
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
  readonly username!: string;

  @IsString()
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email address' })
  readonly email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
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
