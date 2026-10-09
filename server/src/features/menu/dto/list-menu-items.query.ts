import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SLUG_PATTERN } from 'lib/constants/menuConstants';

export const MENU_SORTS = [
  'relevance',
  'menu',
  'name',
  'price',
  '-price',
  'newest',
] as const;
export type MenuSort = (typeof MENU_SORTS)[number];

export const MENU_VISIBILITY = ['visible', 'hidden'] as const;
export type MenuVisibility = (typeof MENU_VISIBILITY)[number];

const cleanSearch = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned === '' ? undefined : cleaned;
};

export class ListMenuItemsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;

  @IsOptional()
  @Transform(cleanSearch)
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Matches(SLUG_PATTERN, { message: 'category must be a slug like "mains"' })
  category?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'available must be true or false' })
  available?: boolean;

  @IsOptional()
  @IsIn(MENU_SORTS)
  sort?: MenuSort;
}

export class AdminListMenuItemsQuery extends ListMenuItemsQuery {
  @IsOptional()
  @IsIn(MENU_VISIBILITY)
  visibility?: MenuVisibility;
}
