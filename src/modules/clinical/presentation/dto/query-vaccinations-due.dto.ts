import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * GET /vaccinations/due - danh sach mui sap den han de le tan goi nhac (P9-T3).
 *
 * `days` bao gom ca cac mui DA QUA HAN, khong chi cac mui sap toi: mot mui qua han 3
 * ngay la cai le tan can goi GAP nhat, va de no roi ra ngoai danh sach thi khong ai goi
 * nua. Xem `VaccinationsService.findDue`.
 */
export class QueryVaccinationsDueDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days: number = 30;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
