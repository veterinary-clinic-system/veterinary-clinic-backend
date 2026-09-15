import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class RevenueFilterQueryDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
