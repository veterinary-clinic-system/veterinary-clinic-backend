import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from './transforms';

export class QueryInventoryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  /** Tim theo ten hoac ma mat hang. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Chi lay cac dong da cham nguong `minimum_stock` - FR-18-04. */
  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  lowStock?: boolean;
}
