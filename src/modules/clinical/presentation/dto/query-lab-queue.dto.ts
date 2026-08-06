import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { LabTestStatus } from '@/shared/common/enums/lab-test-status.enum';

/**
 * GET /laboratories/queue - hang cho xet nghiem (P9-T7).
 *
 * Mac dinh CHUA lay `COMPLETED`: hang cho la nhung viec CON PHAI LAM. Muon xem lai viec
 * da xong thi loc `status=COMPLETED` mot cach tuong minh.
 */
export class QueryLabQueueDto {
  @IsOptional()
  @IsEnum(LabTestStatus)
  status?: LabTestStatus;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
