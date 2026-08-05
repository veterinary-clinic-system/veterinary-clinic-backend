import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { PurchaseOrderStatus } from '@/shared/common/enums/purchase-order-status.enum';

/** `GET /catalog/purchase-orders`. */
export class QueryPurchaseOrdersDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  /** Tim theo ma don. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Loc theo `order_date`, `YYYY-MM-DD`, tinh ca ngay nay. */
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @IsOptional()
  @IsISO8601()
  toDate?: string;
}
