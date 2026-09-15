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

  @IsOptional()
  @IsUUID()
  purchaseOrderItemId?: string;

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

  @IsOptional()
  @IsISO8601()
  expiryDate?: string;
}

export class CreateGoodsReceiptDto {
  
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsUUID()
  supplierId: string;

  @IsUUID()
  branchId: string;

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
