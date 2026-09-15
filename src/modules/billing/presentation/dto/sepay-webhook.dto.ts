import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SepayWebhookDto {
  
  @Type(() => String)
  @IsString()
  id: string;

  @IsIn(['in', 'out'])
  transferType: 'in' | 'out';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  transferAmount: number;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  gateway?: string;

  @IsOptional()
  @IsString()
  referenceCode?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  transactionDate?: string;
}
