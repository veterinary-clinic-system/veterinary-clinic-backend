import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Che do NGAY cua lich lam viec (FR-05-03). `date` la ngay can xem; bo trong = hom nay.
 */
export class QueryDayDto {
  @IsUUID(undefined, { message: 'Chi nhánh không hợp lệ' })
  branchId: string;

  @IsUUID(undefined, { message: 'Bác sĩ không hợp lệ' })
  doctorId: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày không hợp lệ' })
  date?: string;
}

/**
 * Che do THANG (FR-05-03). `monthOf` la ngay bat ky trong thang can xem.
 *
 * `doctorId` TUY CHON - khac hai che do kia: che do thang la goc nhin tong quan cua
 * quan ly ("thang nay chi nhanh chay bao nhieu ca"), bo trong nghia la ca chi nhanh.
 */
export class QueryMonthDto {
  @IsUUID(undefined, { message: 'Chi nhánh không hợp lệ' })
  branchId: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'Bác sĩ không hợp lệ' })
  doctorId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Tháng không hợp lệ' })
  monthOf?: string;
}
