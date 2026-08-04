import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Gan bac si cho mot luot cho.
 *
 * `startAt` tuy chon: bo trong thi he thong tu chon khung gio TRONG SOM NHAT con lai
 * trong ngay cua bac si do (truong hop thuong gap tai quay - "ai ranh thi nhan"). Chi
 * dien khi le tan muon chot dung mot khung gio cu the.
 */
export class AssignDoctorDto {
  @IsUUID()
  doctorId: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;
}
