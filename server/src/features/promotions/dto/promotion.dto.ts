import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DAYS, TIME_PATTERN, type Day } from 'lib/opening-hours';
import {
  MAX_PERCENT,
  MAX_WINDOWS,
  ROUND_STEPS,
  STAMP_PATTERN,
  type PromotionScope,
} from 'lib/promotions';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);
const emptyToNull = Transform(({ value }: { value: unknown }) =>
  value === '' || value === undefined ? null : value,
);

export class PromotionWindowDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(DAYS, { each: true })
  days!: Day[];

  @Matches(TIME_PATTERN, { message: 'Use a 24-hour time, like 17:00' })
  from!: string;

  @Matches(TIME_PATTERN, { message: 'Use a 24-hour time, like 19:00' })
  to!: string;
}

export class SavePromotionDto {
  @trim
  @IsString()
  @MaxLength(40)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_PERCENT)
  percentOff!: number;

  @IsIn(ROUND_STEPS)
  roundTo!: number;

  @IsIn(['menu', 'categories', 'dishes'])
  scope!: PromotionScope;

  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsMongoId({ each: true })
  categoryIds: string[] = [];

  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsMongoId({ each: true })
  dishIds: string[] = [];

  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsMongoId({ each: true })
  excludedDishIds: string[] = [];

  @emptyToNull
  @IsOptional()
  @Matches(STAMP_PATTERN, { message: 'Pick a date and time' })
  startsAt: string | null = null;

  @emptyToNull
  @IsOptional()
  @Matches(STAMP_PATTERN, { message: 'Pick a date and time' })
  endsAt: string | null = null;

  @IsArray()
  @ArrayMaxSize(MAX_WINDOWS)
  @ValidateNested({ each: true })
  @Type(() => PromotionWindowDto)
  windows: PromotionWindowDto[] = [];

  @IsString()
  @MaxLength(64)
  timezone!: string;

  @IsOptional()
  @IsBoolean()
  isActive: boolean = true;
}

export class SetPromotionActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
