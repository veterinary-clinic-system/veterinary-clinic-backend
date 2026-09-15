import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Shared optional date-range + branch filter for reports that make sense to run over
 * all-time data when unbounded (exam-volume-by-disease-group, ai-accuracy). Unlike
 * `RevenueFilterQueryDto`, `from`/`to` are both optional here.
 */
export class DateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
