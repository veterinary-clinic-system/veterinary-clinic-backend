import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';

/**
 * Backs GET /pets (Section 4.1.1 "Search profiles by name, phone number, or record ID").
 * `search` is matched against pet name, owner phone, and pet id (service-side).
 */
export class QueryPetsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
