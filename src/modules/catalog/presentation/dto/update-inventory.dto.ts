import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ParseOptionalBoolean } from './transforms';

/**
 * PATCH /catalog/inventory/:id. Two mutually-exclusive ways to change stock:
 *  - `inventoryQuantity`: set the absolute stock level (e.g. after a physical count).
 *  - `delta`: add/subtract from the current level (e.g. -3 for a sale, +20 for a
 *    delivery) - convenient for callers that don't want to read-then-write.
 * Providing both is rejected by the service layer. `active` toggles whether the row is
 * still counted (e.g. discontinued at this branch) without deleting stock history.
 *
 * Tu P6: ca hai duong deu duoc quy ve mot lenh dieu chinh CO SINH SO CAI - khong con
 * duong ghi thang vao `inventory_quantity` nua (xem comment dau `InventoryService`).
 */
export class UpdateInventoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  inventoryQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  delta?: number;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;

  /** Ly do dieu chinh - di thang vao `note` cua dong so cai. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
