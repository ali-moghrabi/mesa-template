import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
} from 'class-validator';

export class DeleteMenuItemsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Pick at least one dish' })
  @ArrayMaxSize(100, { message: 'Delete at most 100 dishes at a time' })
  @ArrayUnique()
  @IsMongoId({ each: true })
  ids!: string[];
}
