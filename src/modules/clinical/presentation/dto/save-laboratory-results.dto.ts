import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { LaboratoryResultDto } from './laboratory-result.dto';

/**
 * PUT /laboratories/orders/:id/results - ky thuat vien tra ket qua (P9-T5, P9-T7).
 *
 * PUT chu khong POST vi day la lenh THAY THE toan bo bang chi so cua mot yeu cau xet
 * nghiem: ky thuat vien nhin mot phieu ket qua va go lai ca bang, khong them tung dong.
 * Chi so bi bo khoi danh sach nghia la go nham va phai bien mat; POST-them-tung-dong se
 * de lai dong go nham ma khong co duong nao xoa.
 *
 * Luu ket qua se dua yeu cau ve `COMPLETED` va dat `resultDate` neu chua co - xem
 * `LaboratoriesService.saveResults`.
 */
export class SaveLaboratoryResultsDto {
  @IsArray()
  // 200 chi so la gap nhieu lan mot bang cong thuc mau day du - nguong nay chi de chan
  // mot request loi lam khoa bang bang vai nghin dong INSERT.
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LaboratoryResultDto)
  results: LaboratoryResultDto[];

  /** Thoi diem co ket qua. Bo trong = bay gio (khi yeu cau chua co `resultDate`). */
  @IsOptional()
  @IsDateString()
  resultDate?: string;

  /** Ket qua dinh tinh / dien giai - di song song voi bang chi so, khong thay the no. */
  @IsOptional()
  @IsString()
  resultText?: string;
}
