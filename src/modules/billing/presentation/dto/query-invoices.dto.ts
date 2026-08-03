import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';

/** GET /billing/invoices filters, layered onto the shared pagination query DTO. */
export class QueryInvoicesDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  // `@Type(() => Boolean)` would coerce any non-empty string (including "false") to
  // true, since class-transformer's numeric/boolean Type just calls Boolean(value) -
  // an explicit string comparison is needed for a `?paid=false` query param to work.
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === true || value === 'true'))
  @IsBoolean()
  paid?: boolean;
}
