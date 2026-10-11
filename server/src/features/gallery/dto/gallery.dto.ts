import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  GALLERY_ALBUMS,
  MAX_ALT,
  MAX_CAPTION,
  MAX_GALLERY_PHOTOS,
  MAX_PHOTOS_PER_ADD,
  type GalleryAlbum,
} from 'lib/gallery';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

export class NewGalleryPhotoDto {
  @IsString()
  @MaxLength(200)
  image!: string;

  @IsInt()
  @Min(1)
  @Max(20_000)
  width!: number;

  @IsInt()
  @Min(1)
  @Max(20_000)
  height!: number;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(MAX_ALT)
  alt?: string;

  @IsOptional()
  @IsIn(GALLERY_ALBUMS)
  album?: GalleryAlbum;
}

export class AddGalleryPhotosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PHOTOS_PER_ADD)
  @ValidateNested({ each: true })
  @Type(() => NewGalleryPhotoDto)
  photos!: NewGalleryPhotoDto[];
}

export class UpdateGalleryPhotoDto {
  @IsOptional()
  @trim
  @IsString()
  @MaxLength(MAX_ALT)
  alt?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(MAX_CAPTION)
  caption?: string;

  @IsOptional()
  @IsIn(GALLERY_ALBUMS)
  album?: GalleryAlbum;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

class IdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GALLERY_PHOTOS)
  @ArrayUnique()
  @IsMongoId({ each: true })
  ids!: string[];
}

export class BulkChangesDto {
  @IsOptional()
  @IsIn(GALLERY_ALBUMS)
  album?: GalleryAlbum;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class BulkUpdateGalleryDto extends IdsDto {
  @ValidateNested()
  @Type(() => BulkChangesDto)
  set!: BulkChangesDto;
}

export class ReorderGalleryDto extends IdsDto {}

export class DeleteGalleryPhotosDto extends IdsDto {}
