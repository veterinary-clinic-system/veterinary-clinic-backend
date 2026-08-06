import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * PATCH /medical-records/:id/amend - sua ho so benh an DA HOAN TAT (SRS FR-08, P10-T2).
 *
 * FR-08 viet: *"Neu can sua, phai luu audit log"*. P4-T4 moi lam ve NUA DAU cua cau do -
 * chan sua ho so `COMPLETED` (BR-08) - va khong mo duong nao de sua ca, nen nua sau cua
 * cau chua bao gio duoc thuc thi. Endpoint nay la nua sau.
 *
 * `reason` BAT BUOC va toi thieu 10 ky tu. Do la toan bo ly do endpoint nay ton tai:
 * mot lan sua ho so y te da chot ma khong noi ro vi sao thi khong khac gi sua len chinh
 * ho so, va nhat ky chi ghi lai duoc "co nguoi da sua" - vo dung voi nguoi doc lai nam
 * sau. Nguong 10 ky tu de chan "sua", "abc", "." - khong chan duoc nguoi co y viet bay,
 * nhung chan duoc thoi quen bam qua cho xong.
 */
export class AmendMedicalRecordDto {
  // THU TU DECORATOR CO Y NGHIA. `main.ts` bat `stopAtFirstError`, va class-validator
  // chay cac decorator theo chieu NGUOC voi thu tu khai bao - nen cai viet CUOI cung se
  // duoc bao truoc. De `@MaxLength` o duoi thi mot request thieu han `reason` se nhan
  // thong bao "khong duoc vuot qua 1000 ky tu" cho mot gia tri khong ton tai.
  @MaxLength(1000)
  @MinLength(10, {
    message: 'Lý do sửa hồ sơ đã hoàn tất phải mô tả rõ ràng (ít nhất 10 ký tự).',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phải nêu lý do khi sửa hồ sơ bệnh án đã hoàn tất.' })
  reason: string;

  @IsOptional()
  @IsString()
  visitReason?: string | null;

  @IsOptional()
  @IsString()
  generalCondition?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
