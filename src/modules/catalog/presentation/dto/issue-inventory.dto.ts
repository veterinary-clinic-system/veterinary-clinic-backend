import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { InventoryTransactionType } from '@/shared/common/enums/inventory-transaction-type.enum';

/**
 * Cac ly do xuat kho THU CONG - `POST /catalog/inventory/issue`.
 *
 * `SALE` va `DISPENSE` CO CHU DICH khong nam trong danh sach: hai loai do phai di kem
 * mot hoa don (P8) hoac mot don thuoc (P7) va duoc chinh cac module do goi
 * `InventoryService.issue` voi `referenceId` tuong ung. Cho phep xuat tay kieu `SALE`
 * qua endpoint nay se tao ra nhung lan xuat khong co hoa don di kem - dung thu lam bao
 * cao doanh thu khong bao gio khop voi bao cao kho.
 */
const MANUAL_ISSUE_TYPES = [
  InventoryTransactionType.DAMAGED,
  InventoryTransactionType.EXPIRED,
  InventoryTransactionType.LOSS,
  InventoryTransactionType.RETURN,
] as const;

export class IssueInventoryDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  branchId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsIn(MANUAL_ISSUE_TYPES as unknown as string[])
  type: (typeof MANUAL_ISSUE_TYPES)[number];

  /** Ly do - bat buoc: mot lan xuat hang hong khong ly do la khong doi soat duoc. */
  @IsString()
  @MaxLength(500)
  note: string;
}

/** `POST /catalog/inventory/receive` - nhap kho khong qua phieu nhap (hang mau, hang le). */
export class ReceiveInventoryDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  branchId: string;

  @IsString()
  @MaxLength(64)
  batchNo: string;

  /** `YYYY-MM-DD`. Bo trong voi hang khong co han dung. */
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
