import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from './transforms';

/** Shared list query for `GET /catalog/services` and `GET /catalog/medications`. */
export class QueryCatalogEntryDto extends PaginationQueryDto {
  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;
}
