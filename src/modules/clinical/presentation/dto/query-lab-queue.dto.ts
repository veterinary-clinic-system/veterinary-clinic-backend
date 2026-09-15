import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { LabTestStatus } from '@/shared/common/enums/lab-test-status.enum';

export class QueryLabQueueDto {
  @IsOptional()
  @IsEnum(LabTestStatus)
  status?: LabTestStatus;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
