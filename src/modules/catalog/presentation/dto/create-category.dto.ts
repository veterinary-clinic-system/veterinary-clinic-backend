import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ItemType } from '@/shared/common/enums/item-type.enum';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(255)
  categoryName: string;

  @IsString()
  @MaxLength(64)
  code: string;

  @IsEnum(ItemType)
  itemType: ItemType;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
