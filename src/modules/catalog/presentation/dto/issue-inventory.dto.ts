import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { InventoryTransactionType } from '@/shared/common/enums/inventory-transaction-type.enum';

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

  @IsString()
  @MaxLength(500)
  note: string;
}

export class ReceiveInventoryDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  branchId: string;

  @IsString()
  @MaxLength(64)
  batchNo: string;

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
