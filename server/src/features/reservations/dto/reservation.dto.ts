import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  DATE_PATTERN,
  NOTES_MAX,
  PHONE_PATTERN,
  TIME_PATTERN,
} from 'lib/reservations';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/[^\S\n]+/g, ' ') : value,
);

export class CreateReservationDto {
  @Matches(DATE_PATTERN, { message: 'Choose a date' })
  date!: string;

  @Matches(TIME_PATTERN, { message: 'Choose a time' })
  time!: string;

  @Type(() => Number)
  @IsInt({ message: 'Choose how many guests' })
  @Min(1)
  @Max(100)
  partySize!: number;

  @IsOptional()
  @trim
  @ValidateIf((_, value) => value !== '')
  @Matches(PHONE_PATTERN, { message: 'Enter a phone number we can call' })
  phone?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(40)
  occasion?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(NOTES_MAX, { message: `Keep it under ${NOTES_MAX} characters` })
  notes?: string;

  @IsOptional()
  @Matches(/^[\w-]{8,64}$/)
  idempotencyKey?: string;
}

export class CancelReservationDto {
  @IsOptional()
  @trim
  @IsString()
  @MaxLength(200)
  reason?: string;
}
