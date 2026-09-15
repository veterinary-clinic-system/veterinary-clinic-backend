import { IsIn, IsOptional } from 'class-validator';
import { RevenueFilterQueryDto } from './revenue-filter-query.dto';

export type RevenueGroupBy = 'day' | 'month';

export class RevenueQueryDto extends RevenueFilterQueryDto {
  @IsOptional()
  @IsIn(['day', 'month'])
  groupBy?: RevenueGroupBy = 'day';
}
