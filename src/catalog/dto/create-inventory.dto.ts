import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateInventoryDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  branchId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  inventoryQuantity: number;
}
