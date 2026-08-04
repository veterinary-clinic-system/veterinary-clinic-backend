import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Huy mot lich hen - SRS FR-05-04.
 *
 * `reason` BAT BUOC, khac voi `PATCH /appointments/:id`: huy lich la thao tac phai giai
 * trinh duoc. Khong co ly do thi bao cao huy lich cua P10 chi con la mot con so tron.
 * Do dai toi thieu 3 ky tu de chan cac ly do rong nghia kieu "x".
 */
export class CancelAppointmentDto {
  // Thu tu decorator o day la CO Y va nguoc voi truc giac: class-validator chay tu
  // duoi len, va `main.ts` bat `stopAtFirstError` (mot loi cho moi truong). De
  // `@IsString` duoi cung nen no chay TRUOC - bo trong `reason` se nhan dung thong bao
  // "Vui long nhap ly do", khong phai "khong duoc vuot qua 500 ky tu".
  @MaxLength(500, { message: 'Lý do hủy không được vượt quá 500 ký tự' })
  @MinLength(3, { message: 'Lý do hủy phải có ít nhất 3 ký tự' })
  @IsString({ message: 'Vui lòng nhập lý do hủy lịch hẹn' })
  reason: string;
}

/**
 * Danh dau khach KHONG DEN - FR-06-03.
 *
 * `reason` tuy chon (mac dinh "Khách không đến"): khac voi huy lich, day la ghi nhan
 * mot su viec da roi - le tan khong co gi de giai trinh them ngoai chinh su viec do.
 */
export class MarkNoShowDto {
  @IsOptional()
  @IsString({ message: 'Ghi chú không hợp lệ' })
  @MaxLength(500, { message: 'Ghi chú không được vượt quá 500 ký tự' })
  reason?: string;
}
