import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { ParseOptionalBoolean } from './transforms';

export class QueryItemsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ItemType)
  itemType?: ItemType;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;
}
