import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';

function toOptionalBoolean({ obj, key }: { obj: Record<string, unknown>; key: string }) {
  const raw = obj?.[key];
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  return raw === 'true' || raw === '1';
}

export class QueryCustomersDto extends PaginationQueryDto {
  
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  hasPets?: boolean;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
