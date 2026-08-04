import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * `PATCH /catalog/products/:id`. Cung cac truong CreateProductDto nhung deu tuy chon,
 * cong `active`.
 *
 * `active` duoc ghi len CA `items` LAN `products` (xem ProductsService.update): bo loc
 * gia cong khai doc `items.active`, con man hinh kho doc `products.active` - de lech
 * nhau thi mot san pham ngung kinh doanh van hien ra o mot trong hai cho.
 */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  itemName?: string;

  @IsOptional()
  @IsString()
  describe?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
