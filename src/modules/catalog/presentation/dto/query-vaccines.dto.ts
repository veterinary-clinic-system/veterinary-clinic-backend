import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from './transforms';

export class QueryVaccinesDto extends PaginationQueryDto {
  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsUUID()
  petId?: string;
}
