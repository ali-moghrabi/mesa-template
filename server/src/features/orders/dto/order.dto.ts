import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ORDER_TYPES,
  PAYMENT_METHODS,
  SLOT_PATTERN,
  type OrderType,
  type PaymentMethod,
} from 'lib/ordering';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/[^\S\n]+/g, ' ') : value,
);

export const ADDRESS_LIMITS = {
  street: 120,
  building: 60,
  floor: 20,
  apartment: 20,
  directions: 240,
} as const;
export const NOTES_MAX = 300;

export class OrderAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  areaId?: string;

  @trim
  @IsString()
  @MinLength(3, { message: 'Enter your street' })
  @MaxLength(ADDRESS_LIMITS.street)
  street!: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(ADDRESS_LIMITS.building)
  building?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(ADDRESS_LIMITS.floor)
  floor?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(ADDRESS_LIMITS.apartment)
  apartment?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(ADDRESS_LIMITS.directions)
  directions?: string;
}

export class PlaceOrderDto {
  @IsIn(ORDER_TYPES)
  type!: OrderType;

  @IsIn(PAYMENT_METHODS)
  paymentMethod!: PaymentMethod;

  @ValidateIf((o: PlaceOrderDto) => o.type === 'delivery')
  @ValidateNested()
  @Type(() => OrderAddressDto)
  address?: OrderAddressDto;

  @trim
  @IsString()
  @Matches(/^\+?[0-9][0-9 ()-]{5,22}$/, {
    message: 'Enter a phone number we can call',
  })
  phone!: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(NOTES_MAX)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  cutlery?: boolean;

  @IsOptional()
  @IsString()
  @Matches(SLOT_PATTERN, { message: 'Choose a time from the list' })
  scheduledFor?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  tipPercent?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  cashChangeFor?: number;

  @IsString()
  @Matches(/^[A-Za-z0-9-]{16,64}$/)
  idempotencyKey!: string;

  /** The card typed in the checkout, as a one-time Tap token (tok_…). Card numbers never reach MESA. */
  @IsOptional()
  @IsString()
  @Matches(/^tok_[A-Za-z0-9]{6,64}$/)
  cardToken?: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  expectedTotal!: number;
}
