import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { EmployeeStatus } from '@/shared/common/enums/employee-status.enum';

export class QueryEmployeesDto extends PaginationQueryDto {
  /** Khop gan dung theo ho ten / so dien thoai / ma nhan vien. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  position?: string;
}
