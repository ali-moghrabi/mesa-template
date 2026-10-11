import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsMongoId,
  IsNumber,
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
  ALLERGENS,
  DIETARY_TAGS,
  MAX_SPICE_LEVEL,
  MENU_BADGES,
  SLUG_PATTERN,
  type Allergen,
  type DietaryTag,
  type MenuBadge,
} from 'lib/constants/menuConstants';
import { MAX_PRICE, PRICE_DECIMALS } from 'lib/money';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

const emptyToUndefined = Transform(({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value,
);

const Money = () =>
  applyDecorators(
    IsNumber(
      {
        allowNaN: false,
        allowInfinity: false,
        maxDecimalPlaces: PRICE_DECIMALS,
      },
      {
        message: ({ property }) =>
          `${property} must be a price with at most ${PRICE_DECIMALS} decimals`,
      },
    ),
    Min(0),
    Max(MAX_PRICE),
  );

const Name = (max = 40) =>
  applyDecorators(
    trim,
    IsString(),
    MinLength(1, { message: 'Give it a name' }),
    MaxLength(max),
  );

export class VariantDto {
  @IsOptional()
  @IsMongoId()
  id?: string;

  @Name()
  name!: string;

  @Money()
  price!: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class ModifierOptionDto {
  @IsOptional()
  @IsMongoId()
  id?: string;

  @Name()
  name!: string;

  @IsOptional()
  @Money()
  priceDelta?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class ModifierGroupDto {
  @IsOptional()
  @IsMongoId()
  id?: string;

  @Name()
  name!: string;

  @IsInt()
  @Min(0)
  @Max(30)
  minSelect!: number;

  @IsInt()
  @Min(1)
  @Max(30)
  maxSelect!: number;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ModifierOptionDto)
  options!: ModifierOptionDto[];
}

export class CreateMenuItemDto {
  @Name(80)
  name!: string;

  @IsOptional()
  @emptyToUndefined
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MaxLength(100)
  @Matches(SLUG_PATTERN, {
    message:
      'Use lowercase letters, numbers and dashes, like "basque-cheesecake"',
  })
  slug?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsMongoId({ message: 'Pick a category' })
  categoryId!: string;

  @IsOptional()
  @emptyToUndefined
  @IsString()
  @MaxLength(200)
  image?: string;

  @IsOptional()
  @emptyToUndefined
  @Money()
  price?: number;

  @IsOptional()
  @emptyToUndefined
  @Money()
  compareAtPrice?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants: VariantDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ModifierGroupDto)
  modifierGroups: ModifierGroupDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(DIETARY_TAGS, { each: true })
  dietaryTags: DietaryTag[] = [];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ALLERGENS, { each: true })
  allergens: Allergen[] = [];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SPICE_LEVEL)
  spiceLevel: number = 0;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(MENU_BADGES, { each: true })
  badges: MenuBadge[] = [];

  @IsOptional()
  @emptyToUndefined
  @IsInt()
  @Min(0)
  @Max(5000)
  calories?: number;

  @IsOptional()
  @emptyToUndefined
  @IsInt()
  @Min(0)
  @Max(240)
  prepTimeMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive: boolean = true;

  @IsOptional()
  @IsBoolean()
  isAvailable: boolean = true;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder?: number;
}

export class UpdateMenuItemDto extends CreateMenuItemDto {
  @IsOptional()
  @IsBoolean()
  removeImage?: boolean;

  @IsOptional()
  @IsISO8601()
  version?: string;
}
