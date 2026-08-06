import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * POST /vaccinations - ghi nhan mot mui tiem (SRS FR-12, P9-T2/T3).
 *
 * `batchNo` va `expiryDate` KHONG co trong DTO nay: chung duoc chep tu lo ma kho thuc
 * su da xuat theo FEFO, khong phai tu tay nguoi nhap. Cho nhap tay thi so tiem chung se
 * ghi mot ma lo khac voi lo da tru, va toan bo gia tri truy vet cua no bien mat.
 */
export class CreateVaccinationDto {
  @IsUUID()
  petId: string;

  @IsUUID()
  vaccineId: string;

  /**
   * Ho so benh an di kem. Bo trong khi tiem dich vu don le - xem ghi chu dau
   * `vaccination.entity.ts`. Khi co, `branchId` duoc suy ra tu lich hen cua ho so.
   */
  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;

  /**
   * Chi nhanh tru kho. BAT BUOC khi khong co `medicalRecordId` (khong co lich hen nao
   * de suy ra chi nhanh). Xem `VaccinationsService.resolveBranchId`.
   */
  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** Bo trong = bay gio. Cho nhap de ghi bu mui da tiem hom truoc. */
  @IsOptional()
  @IsDateString()
  vaccinatedAt?: string;

  /**
   * Mui thu may. Bo trong = tu dem tu so mui da tiem cua chinh cap (thu cung, vaccine)
   * nay roi cong 1.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  doseNumber?: number;

  /**
   * Ngay hen mui ke tiep. Bo trong = he thong tu tinh tu phac do; truyen gia tri de bac
   * si ghi de (acceptance P9-T2); truyen `null` de noi ro "khong nhac lai mui nao nua".
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  nextDueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
