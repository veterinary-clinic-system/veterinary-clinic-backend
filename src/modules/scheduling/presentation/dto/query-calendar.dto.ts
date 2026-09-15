import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class QueryDayDto {
  @IsUUID(undefined, { message: 'Chi nhánh không hợp lệ' })
  branchId: string;

  @IsUUID(undefined, { message: 'Bác sĩ không hợp lệ' })
  doctorId: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày không hợp lệ' })
  date?: string;
}

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
