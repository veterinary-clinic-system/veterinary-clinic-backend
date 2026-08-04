import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

/**
 * `POST /catalog/products` - SRS FR-16.
 *
 * Tao mot luc ca `Item` (phan chung: ten, mo ta, gia ban, danh muc) lan `Product`
 * (phan rieng cua hang hoa: SKU, thuong hieu, gia von). Client khong tu tao `Item`
 * truoc roi noi vao - mot san pham khong co item la du lieu vo nghia.
 *
 * KHONG co `code`: ma noi bo (SP0001) do trigger CSDL cap - xem
 * `1791000002000-ItemCodeAndCategory.ts`.
 */
export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  itemName: string;

  @IsOptional()
  @IsString()
  describe?: string;

  /** Gia ban, don vi DONG (so nguyen). */
  @IsInt()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsString()
  @MaxLength(64)
  sku: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  brand?: string;

  @IsString()
  @MaxLength(50)
  unit: string;

  /** Gia von, don vi DONG. Duoc phep lon hon `unitPrice` - co nghiep vu ban lo that. */
  @IsOptional()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;
}
