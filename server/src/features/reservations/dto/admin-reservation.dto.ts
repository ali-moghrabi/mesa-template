import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  DATE_PATTERN,
  NOTES_MAX,
  PHONE_PATTERN,
  RESERVATION_STATUSES,
  TIME_PATTERN,
  type ReservationStatus,
} from 'lib/reservations';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/[^\S\n]+/g, ' ') : value,
);
const bool = Transform(
  ({ value }: { value: unknown }) => value === true || value === 'true',
);

export const TABLE_MAX = 30;
export const STAFF_NOTE_MAX = 1000;

export class DayQuery {
  @IsOptional()
  @Matches(DATE_PATTERN)
  date?: string;
}

export class ListReservationsQuery {
  @IsOptional()
  @IsIn([...RESERVATION_STATUSES, 'upcoming'])
  status?: ReservationStatus | 'upcoming';

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

class ReservationDetailsDto {
  @Matches(DATE_PATTERN, { message: 'Choose a date' })
  date!: string;

  @Matches(TIME_PATTERN, { message: 'Choose a time' })
  time!: string;

  @Type(() => Number)
  @IsInt({ message: 'Enter the number of guests' })
  @Min(1, { message: 'At least 1 guest' })
  @Max(100, { message: 'At most 100 guests' })
  partySize!: number;

  @trim
  @IsString()
  @MinLength(2, { message: "Enter the guest's name" })
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @trim
  @ValidateIf((_, value) => value !== '')
  @Matches(PHONE_PATTERN, { message: 'Enter a valid phone number' })
  phone?: string;

  @IsOptional()
  @trim
  @ValidateIf((_, value) => value !== '')
  @IsEmail({}, { message: 'Enter a valid email' })
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(40)
  occasion?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(NOTES_MAX)
  notes?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(TABLE_MAX)
  table?: string;
}

export class CreateReservationAdminDto extends ReservationDetailsDto {
  @IsIn(['phone', 'walk_in'])
  source!: 'phone' | 'walk_in';

  @IsOptional()
  @bool
  @IsBoolean()
  seatNow?: boolean;

  @IsOptional()
  @bool
  @IsBoolean()
  notify?: boolean;
}

export class UpdateReservationDto extends ReservationDetailsDto {
  @IsISO8601()
  version!: string;

  @IsOptional()
  @bool
  @IsBoolean()
  notify?: boolean;
}

export class ReservationStatusDto {
  @IsIn(RESERVATION_STATUSES)
  status!: ReservationStatus;

  @IsISO8601()
  version!: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(200)
  reason?: string;

  @IsOptional()
  @bool
  @IsBoolean()
  notify?: boolean;
}

export class ReservationNoteDto {
  @trim
  @IsString()
  @MaxLength(STAFF_NOTE_MAX)
  note!: string;
}
