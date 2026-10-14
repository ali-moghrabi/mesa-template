import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsMongoId,
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
  CAMPAIGN_STATUSES,
  type CampaignStatus,
} from 'src/schemas/campaign.schema';
import {
  SUBSCRIBER_SOURCES,
  SUBSCRIBER_STATUSES,
  type SubscriberSource,
  type SubscriberStatus,
} from 'src/schemas/subscriber.schema';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/[^\S\n]+/g, ' ') : value,
);
const tidy = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value
        .replace(/\r\n?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : value,
);
const toInt = Transform(({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Number(value),
);

export const MAX_DISHES = 6;
export const LINK_PATTERN = /^(\/[^\s]*|https?:\/\/[^\s]+)$/;

export class ListSubscribersQuery {
  @IsOptional() @trim @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(SUBSCRIBER_STATUSES) status?: SubscriberStatus;
  @IsOptional() @IsIn(SUBSCRIBER_SOURCES) source?: SubscriberSource;
  @IsOptional() @toInt @IsInt() @Min(1) @Max(10_000) page?: number;
}

export class ExportSubscribersQuery {
  @IsOptional() @IsIn(SUBSCRIBER_STATUSES) status?: SubscriberStatus;
}

export class AddSubscriberDto {
  @trim
  @IsEmail({}, { message: 'Enter a valid email' })
  @MaxLength(120)
  email!: string;
  @IsIn(['confirm', 'given']) consent!: 'confirm' | 'given';
}

export class CampaignButtonDto {
  @trim
  @IsString()
  @MinLength(1, { message: 'Write the button text' })
  @MaxLength(40)
  label!: string;
  @trim
  @Matches(LINK_PATTERN, {
    message: 'Use a page like /menu or a full https:// link',
  })
  @MaxLength(500)
  url!: string;
}

export class SaveCampaignDto {
  @IsOptional() @trim @IsString() @MaxLength(120) subject?: string;
  @IsOptional() @trim @IsString() @MaxLength(160) preheader?: string;
  @IsOptional() @trim @IsString() @MaxLength(120) heading?: string;
  @IsOptional() @tidy @IsString() @MaxLength(10_000) body?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignButtonDto)
  button?: CampaignButtonDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DISHES, { message: `Pick up to ${MAX_DISHES} dishes` })
  @IsMongoId({ each: true })
  dishIds?: string[];

  @IsOptional() @IsISO8601() version?: string;
}

export class ListCampaignsQuery {
  @IsOptional() @IsIn([...CAMPAIGN_STATUSES, 'review']) status?:
    CampaignStatus | 'review';
  @IsOptional() @toInt @IsInt() @Min(1) @Max(10_000) page?: number;
}

export class SendCampaignDto {
  @IsOptional() @IsISO8601() at?: string;
  @IsISO8601() version!: string;
}

export class TestCampaignDto {
  @IsOptional()
  @trim
  @IsEmail({}, { message: 'Enter a valid email' })
  email?: string;
}

export class WelcomeSettingsDto {
  @IsBoolean() enabled!: boolean;
  @tidy @IsString() @MaxLength(1000) message!: string;
}

export class SaleSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsIn(['auto', 'review']) mode!: 'auto' | 'review';
  @IsInt() @Min(1) @Max(90) minPercent!: number;
  @IsInt() @Min(0) @Max(30) cooldownDays!: number;
  @tidy @IsString() @MaxLength(1000) intro!: string;
}

export class AutomationsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => WelcomeSettingsDto)
  welcome?: WelcomeSettingsDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => SaleSettingsDto)
  sale?: SaleSettingsDto;
}
