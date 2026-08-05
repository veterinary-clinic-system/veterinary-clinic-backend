import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PurchaseOrderStatus } from '@/shared/common/enums/purchase-order-status.enum';
import { CreatePurchaseOrderItemDto } from './create-purchase-order.dto';

/**
 * `PATCH /catalog/purchase-orders/:id`.
 *
 * `items` neu co thi THAY THE toan bo cac dong (khong phai vá tung dong): mot don dat
 * hang la mot chung tu, sua no la sua ca ban. Chi lam duoc khi don con `DRAFT` - don da
 * gui nha cung cap ma doi so luong ngam thi phieu nhap se doi soat vao mot ban khac
 * voi ban nha cung cap dang cam.
 *
 * `status` chi nhan chuyen tiep do NGUOI DUNG quyet dinh (`ORDERED`, `CANCELLED`).
 * `PARTIALLY_RECEIVED`/`RECEIVED` do phieu nhap tinh ra, khong ai dat tay duoc.
 */
export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsISO8601()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items?: CreatePurchaseOrderItemDto[];
}
