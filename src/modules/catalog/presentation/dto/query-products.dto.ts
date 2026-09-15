import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from './transforms';

export class QueryProductsDto extends PaginationQueryDto {
  
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;
}
