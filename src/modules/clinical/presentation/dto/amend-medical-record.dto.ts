import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AmendMedicalRecordDto {

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
