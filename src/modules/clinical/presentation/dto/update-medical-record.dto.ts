import { IsOptional, IsString } from 'class-validator';

/**
 * Sua phan than cua ho so - `PATCH /medical-records/:id`. Chi con hieu luc khi ho so
 * o `DRAFT` (BR-08); `MedicalRecordsService.update` la noi chan.
 *
 * `appointmentId`, `petId`, `doctorId` va `status` deu KHONG sua duoc qua day: hai cai
 * dau la danh tinh cua ho so, `status` chi doi qua `POST /medical-records/:id/complete`
 * de vong doi chi co mot cua ra vao.
 */
export class UpdateMedicalRecordDto {
  @IsOptional()
  @IsString()
  visitReason?: string;

  @IsOptional()
  @IsString()
  generalCondition?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
