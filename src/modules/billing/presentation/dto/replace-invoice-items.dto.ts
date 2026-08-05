import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class InvoiceLineDto {
  @IsUUID()
  itemId: string;

  /** Gia CHOT cho dong nay. Client gui len de gia tren hoa don khong tu doi theo bang gia. */
  @IsInt()
  @Min(0)
  price: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

/**
 * PATCH /billing/invoices/:id/items - thay TOAN BO cac dong.
 *
 * Thay ca tap thay vi vá tung dong: hoa don la mot chung tu, sua no la lap lai noi dung
 * chung tu. Mot API vá tung dong se can them khai niem "id dong" o phia client va mo
 * duong cho trang thai nua voi (them duoc dong nhung xoa loi).
 */
export class ReplaceInvoiceItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  items: InvoiceLineDto[];
}
