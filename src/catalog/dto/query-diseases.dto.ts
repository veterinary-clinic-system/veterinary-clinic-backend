import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export class QueryDiseasesDto extends PaginationQueryDto {
  /** ILIKE match against `diseaseName`. */
  @IsOptional()
  @IsString()
  search?: string;
}
