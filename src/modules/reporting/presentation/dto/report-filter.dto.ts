import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';

/**
 * Bo loc bao cao doanh thu theo SRS muc 19 (P10-T4).
 *
 * SRS liet ke ba bo loc: `From/To Date`, `Payment Method`, `Employee`.
 * `RevenueFilterQueryDto` cu chi co hai cai dau (va `branchId`) - hai cai con lai duoc
 * them o day thay vi noi rong DTO cu, de cac bao cao da chay tu P8 khong doi hop dong.
 *
 * `employeeUserId` loc theo NGUOI THU TIEN (`payments.received_by_user_id`), khong phai
 * bac si kham. Cau hoi cua muc 19 la "nhan vien nay thu duoc bao nhieu" - doanh thu theo
 * bac si da co bao cao rieng (`/reports/revenue/by-doctor`) va tra loi cau khac han.
 */
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
