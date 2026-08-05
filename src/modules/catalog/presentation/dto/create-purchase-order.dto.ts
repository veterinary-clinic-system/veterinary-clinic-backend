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

export class CreatePurchaseOrderItemDto {
  @IsUUID()
  itemId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  /** Gia nhap thoa thuan, tinh bang DONG. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitCost: number;
}

/**
 * `POST /catalog/purchase-orders` - SRS UC-05.
 *
 * KHONG co `totalAmount`: tong tien la gia tri phai sinh tu cac dong, service tinh lay.
 * Nhan tu client thi som muon se co don co tong khong khop cac dong.
 * KHONG co `status`: don moi luon la `DRAFT`.
 */
export class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()
  branchId: string;

  /** `YYYY-MM-DD`. Bo trong thi lay ngay hom nay. */
  @IsOptional()
  @IsISO8601()
  orderDate?: string;

  @IsOptional()
  @IsISO8601()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}
