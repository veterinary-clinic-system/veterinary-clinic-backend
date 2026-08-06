import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from './transforms';

/**
 * GET /catalog/vaccines - acceptance P9-T1 doi loc theo loai.
 *
 * `speciesId` loc theo bang noi `vaccine_species` VA giu lai nhung vaccine khong khai
 * loai nao (dung cho moi loai). Loc bang mot INNER JOIN don thuan se lam vaccine dai
 * bien mat khoi o chon cua bac si dang kham cho - dung cai bac si can nhat.
 */
export class QueryVaccinesDto extends PaginationQueryDto {
  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  /** Loc theo loai suy ra tu chinh thu cung - tien hon cho man hinh kham. */
  @IsOptional()
  @IsUUID()
  petId?: string;
}
