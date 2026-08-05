import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';

/** `GET /catalog/goods-receipts`. */
export class QueryGoodsReceiptsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  /** Tim theo ma phieu. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Loc theo `received_date`, `YYYY-MM-DD`, tinh ca ngay nay. */
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @IsOptional()
  @IsISO8601()
  toDate?: string;
}
