import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SetCartDiscountDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percent?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
