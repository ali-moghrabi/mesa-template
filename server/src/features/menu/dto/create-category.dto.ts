import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  SLUG_PATTERN,
  TIME_PATTERN,
  WEEK_DAYS,
  type WeekDay,
} from 'lib/constants/menuConstants';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);
const emptyToUndefined = Transform(({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value,
);

export class ServingWindowDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(WEEK_DAYS, { each: true })
  days: WeekDay[] = [];

  @Matches(TIME_PATTERN, { message: 'from must be a time like 07:00' })
  from!: string;

  @Matches(TIME_PATTERN, { message: 'to must be a time like 11:30' })
  to!: string;
}

export class CreateMenuCategoryDto {
  @trim
  @IsString()
  @MinLength(1, { message: 'Give the category a name' })
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @emptyToUndefined
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_PATTERN, {
    message: 'Use lowercase letters, numbers and dashes, like "hot-drinks"',
  })
  slug?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @emptyToUndefined
  @IsString()
  @MaxLength(200)
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive: boolean = true;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ServingWindowDto)
  servingHours: ServingWindowDto[] = [];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}
