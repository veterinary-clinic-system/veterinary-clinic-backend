import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { StockTakeStatus } from '@/shared/common/enums/stock-take-status.enum';

export class QueryStockTakesDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(StockTakeStatus)
  status?: StockTakeStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
