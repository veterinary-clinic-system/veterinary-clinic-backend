import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Shared required date-range + optional branch filter for the revenue breakdown reports
 * (by-service, by-doctor) and the base of `RevenueQueryDto`. `from`/`to` are mandatory -
 * unlike `DateRangeQueryDto` - so a caller can't accidentally sum/scan every paid invoice
 * ever issued.
 */
export class RevenueFilterQueryDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
