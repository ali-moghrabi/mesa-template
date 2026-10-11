import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
} from 'class-validator';

export class DeleteMenuCategoriesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Pick at least one category' })
  @ArrayMaxSize(50, { message: 'Delete at most 50 categories at a time' })
  @ArrayUnique()
  @IsMongoId({ each: true })
  ids!: string[];

  @IsOptional()
  @IsBoolean()
  deleteDishes: boolean = false;
}
