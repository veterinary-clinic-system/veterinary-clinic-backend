import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';

export class QueryDiseasesDto extends PaginationQueryDto {
  
  @IsOptional()
  @IsString()
  search?: string;
}
