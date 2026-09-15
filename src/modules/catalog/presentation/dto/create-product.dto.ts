import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  @IsString()
  @MaxLength(255)
  itemName: string;

  @IsOptional()
  @IsString()
  describe?: string;

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

  @IsOptional()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;
}
