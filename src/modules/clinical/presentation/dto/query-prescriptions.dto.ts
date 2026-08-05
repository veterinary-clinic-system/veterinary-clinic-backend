import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { PrescriptionStatus } from '@/shared/common/enums/prescription-status.enum';

/**
 * `GET /prescriptions` - SRS FR-11.
 *
 * `?status=PRESCRIBED` chinh la hang cho cua quay thuoc (acceptance P7-T5), nen khi loc
 * theo trang thai do thi thu tu mac dinh phai la CU NHAT TRUOC - nguoc voi moi danh
 * sach khac trong he thong. Don cho lau nhat phai duoc soan truoc.
 */
export class QueryPrescriptionsDto extends PaginationQueryDto {
  /**
   * KHAI BAO LAI de BO gia tri mac dinh `'DESC'` cua `PaginationQueryDto`.
   *
   * Khong bo thi `sortOrder` khong bao gio la `undefined`, va `PrescriptionsService`
   * mat kha nang phan biet "nguoi dung chu dong chon DESC" voi "nguoi dung khong chon
   * gi" - nhanh sap cu-nhat-truoc cua hang cho se thanh ma chet. Bo di thi service tu
   * chon huong theo `status`, con nguoi dung van ep duoc bang `?sortOrder=`.
   *
   * PHAI viet `= undefined` chu khong duoc khai bao tran: `target` la ES2021 va
   * `useDefineForClassFields` tat, nen mot khai bao khong co gia tri khoi tao KHONG
   * sinh ma nao ca - gia tri `'DESC'` cua lop cha se van con nguyen.
   */
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = undefined;

  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;

  @IsOptional()
  @IsUUID()
  petId?: string;

  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;

  /** Loc theo chi nhanh cua lan kham - quay thuoc chi soan don cua chi nhanh minh. */
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
