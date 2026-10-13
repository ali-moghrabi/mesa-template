import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ORDER_TYPES } from 'lib/ordering';
import { ORDER_STATUSES, type OrderStatus } from 'src/schemas/order.schema';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/[^\S\n]+/g, ' ') : value,
);

export class ListOrdersQuery {
  @IsOptional()
  @IsIn([...ORDER_STATUSES, 'active'])
  status?: OrderStatus | 'active';

  @IsOptional()
  @IsIn(ORDER_TYPES)
  type?: 'delivery' | 'pickup';

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

export class ChangeStatusDto {
  @IsIn(ORDER_STATUSES)
  status!: OrderStatus;

  @IsString()
  @MaxLength(40)
  version!: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(240)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  refund?: boolean;
}

export class EditLineDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  index?: number;

  @IsOptional()
  @IsMongoId()
  itemId?: string;

  @IsOptional()
  @IsMongoId()
  variantId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsMongoId({ each: true })
  optionIds?: string[];

  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(140)
  note?: string;
}

export class EditOrderDto {
  @IsString()
  @MaxLength(40)
  version!: string;

  @IsArray()
  @ArrayMinSize(1, {
    message: 'An order needs at least one dish. Cancel it instead.',
  })
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => EditLineDto)
  lines!: EditLineDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000)
  deliveryFee?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000)
  discount?: number;

  @trim
  @IsString()
  @MinLength(2, { message: 'Say why the order changed' })
  @MaxLength(240)
  reason!: string;
}

export class RefundDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  amount!: number;

  @trim
  @IsString()
  @MinLength(2, { message: 'Say why you refund' })
  @MaxLength(240)
  reason!: string;
}

export class StaffNoteDto {
  @trim
  @IsString()
  @MaxLength(500)
  note!: string;
}
