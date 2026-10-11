import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  DATE_PATTERN,
  DAYS,
  MAX_LABEL,
  MAX_SHIFTS,
  MAX_SPECIAL_DAYS,
  TIME_PATTERN,
  type Day,
} from 'lib/opening-hours';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

export class ShiftDto {
  @Matches(TIME_PATTERN, { message: 'Use a 24-hour time, like 19:30' })
  open!: string;

  @Matches(TIME_PATTERN, { message: 'Use a 24-hour time, like 23:00' })
  close!: string;
}

export class DayHoursDto {
  @IsIn(DAYS)
  day!: Day;

  @IsArray()
  @ArrayMaxSize(MAX_SHIFTS, { message: `At most ${MAX_SHIFTS} shifts a day` })
  @ValidateNested({ each: true })
  @Type(() => ShiftDto)
  shifts!: ShiftDto[];
}

export class SpecialDayDto {
  @Matches(DATE_PATTERN, { message: 'Pick a date' })
  date!: string;

  @trim
  @IsString()
  @MaxLength(MAX_LABEL)
  label!: string;

  @IsArray()
  @ArrayMaxSize(MAX_SHIFTS, { message: `At most ${MAX_SHIFTS} shifts a day` })
  @ValidateNested({ each: true })
  @Type(() => ShiftDto)
  shifts!: ShiftDto[];
}

export class OpeningHoursDto {
  @IsString()
  @MaxLength(64)
  timezone!: string;

  @IsArray()
  @ArrayMinSize(7, { message: 'Give all 7 days' })
  @ArrayMaxSize(7, { message: 'Give all 7 days' })
  @ValidateNested({ each: true })
  @Type(() => DayHoursDto)
  weekly!: DayHoursDto[];

  @IsArray()
  @ArrayMaxSize(MAX_SPECIAL_DAYS, {
    message: `At most ${MAX_SPECIAL_DAYS} special days`,
  })
  @ValidateNested({ each: true })
  @Type(() => SpecialDayDto)
  exceptions!: SpecialDayDto[];
}

export class SaveOpeningHoursDto {
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  hours!: OpeningHoursDto;

  @IsOptional()
  @IsISO8601()
  version?: string | null;
}
