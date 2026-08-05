import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateGoodsReceiptItemDto {
  @IsUUID()
  itemId: string;

  /** Dong tren don dat de doi soat. Bo trong khi nhap khong theo don. */
  @IsOptional()
  @IsUUID()
  purchaseOrderItemId?: string;

  /** So THUC NHAN. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitCost: number;

  @IsString()
  @MaxLength(64)
  batchNo: string;

  /** `YYYY-MM-DD`. Bo trong voi hang khong co han dung. */
  @IsOptional()
  @IsISO8601()
  expiryDate?: string;
}

/**
 * `POST /catalog/goods-receipts` - SRS UC-05, BR-13.
 *
 * Mot lan goi la MOT giao dich tron ven: lap phieu, tao/cong lo, ghi so cai, cap nhat
 * so da nhan cua don va tinh lai trang thai don. Khong co buoc "xac nhan" rieng - xem
 * comment dau `GoodsReceipt`.
 */
export class CreateGoodsReceiptDto {
  /** Don dat tuong ung. Bo trong khi nhap hang le / hang mau. */
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsUUID()
  supplierId: string;

  @IsUUID()
  branchId: string;

  /** `YYYY-MM-DD`. Bo trong thi lay ngay hom nay. */
  @IsOptional()
  @IsISO8601()
  receivedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  items: CreateGoodsReceiptItemDto[];
}
