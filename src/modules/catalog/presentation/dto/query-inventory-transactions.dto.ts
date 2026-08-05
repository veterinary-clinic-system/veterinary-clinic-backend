import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { InventoryTransactionType } from '@/shared/common/enums/inventory-transaction-type.enum';

/**
 * `GET /catalog/inventory-transactions` - so cai xuat-nhap (P6-T8).
 *
 * `itemId` loc theo MAT HANG (moi chi nhanh), `inventoryItemId` loc theo dong ton kho
 * cu the (mot mat hang tai mot chi nhanh). Giu ca hai vi man hinh kho di tu dong ton
 * kho, con bao cao o P10 di tu mat hang.
 */
export class QueryInventoryTransactionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @IsOptional()
  @IsEnum(InventoryTransactionType)
  type?: InventoryTransactionType;

  /** `YYYY-MM-DD`, tinh ca ngay nay. */
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  /** `YYYY-MM-DD`, tinh ca ngay nay. */
  @IsOptional()
  @IsISO8601()
  toDate?: string;
}
