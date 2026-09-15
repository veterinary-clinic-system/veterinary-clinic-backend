import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';

export class ReportFilterDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID()
  employeeUserId?: string;
}
