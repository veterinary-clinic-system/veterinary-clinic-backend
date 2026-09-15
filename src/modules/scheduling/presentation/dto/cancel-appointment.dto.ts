import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CancelAppointmentDto {

  @MaxLength(500, { message: 'Lý do hủy không được vượt quá 500 ký tự' })
  @MinLength(3, { message: 'Lý do hủy phải có ít nhất 3 ký tự' })
  @IsString({ message: 'Vui lòng nhập lý do hủy lịch hẹn' })
  reason: string;
}

export class MarkNoShowDto {
  @IsOptional()
  @IsString({ message: 'Ghi chú không hợp lệ' })
  @MaxLength(500, { message: 'Ghi chú không được vượt quá 500 ký tự' })
  reason?: string;
}
