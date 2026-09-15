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

export class CreateStockTakeDto {
  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsISO8601()
  takenDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  inventoryItemIds?: string[];
}

export class CountStockTakeItemDto {
  @IsUUID()
  stockTakeItemId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedQuantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SubmitStockTakeCountsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CountStockTakeItemDto)
  items: CountStockTakeItemDto[];
}

export class ConfirmStockTakeDto {
  
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
