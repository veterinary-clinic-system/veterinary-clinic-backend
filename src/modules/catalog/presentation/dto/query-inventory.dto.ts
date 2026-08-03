import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';

export class QueryInventoryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
