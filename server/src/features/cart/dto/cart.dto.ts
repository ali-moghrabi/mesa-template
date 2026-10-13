import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_LINE_NOTE, MAX_LINE_QUANTITY } from 'src/schemas/cart.schema';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
);

export class AddCartLineDto {
  @IsMongoId()
  itemId!: string;

  @IsOptional()
  @IsMongoId()
  variantId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsMongoId({ each: true })
  optionIds: string[] = [];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity: number = 1;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(MAX_LINE_NOTE)
  note?: string;
}

export class UpdateCartLineDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}
