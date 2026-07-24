import { IsIn, IsOptional } from 'class-validator';
import { RevenueFilterQueryDto } from './revenue-filter-query.dto';

export type RevenueGroupBy = 'day' | 'month';

/** GET /reports/revenue - adds the day/month bucketing option to the shared revenue filter. */
export class RevenueQueryDto extends RevenueFilterQueryDto {
  @IsOptional()
  @IsIn(['day', 'month'])
  groupBy?: RevenueGroupBy = 'day';
}
