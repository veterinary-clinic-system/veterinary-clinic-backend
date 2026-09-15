import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Gender } from '@/shared/common/enums/gender.enum';

export class CreatePetDto {
  @IsUUID(undefined, { message: 'Chủ nuôi không hợp lệ' })
  ownerId: string;

  @IsString({ message: 'Vui lòng nhập tên thú cưng' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên thú cưng' })
  name: string;

  @IsUUID(undefined, { message: 'Vui lòng chọn loài' })
  speciesId: string;

  @IsUUID(undefined, { message: 'Vui lòng chọn giống' })
  breedId: string;

  @IsEnum(Gender, { message: 'Giới tính không hợp lệ' })
  gender: Gender;

  @IsOptional()
  @IsNumber({}, { message: 'Cân nặng phải là số' })
  @Min(0, { message: 'Cân nặng không được âm' })
  weight?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  birthDate?: string;

  @IsOptional()
  @IsString({ message: 'Số microchip không hợp lệ' })
  @MaxLength(64, { message: 'Số microchip không được vượt quá 64 ký tự' })
  microchipId?: string;

  @IsOptional()
  @IsString({ message: 'Màu lông không hợp lệ' })
  @MaxLength(64, { message: 'Màu lông không được vượt quá 64 ký tự' })
  color?: string;

  @IsOptional()
  @IsString({ message: 'Ảnh đại diện không hợp lệ' })
  avatarUrl?: string;

  @IsOptional()
  @IsString({ message: 'Ghi chú không hợp lệ' })
  notes?: string;

  @IsOptional()
  @IsArray({ message: 'Danh sách dị ứng không hợp lệ' })
  @IsString({ each: true, message: 'Danh sách dị ứng không hợp lệ' })
  allergies?: string[];

  @IsOptional()
  @IsArray({ message: 'Danh sách bệnh mãn tính không hợp lệ' })
  @IsString({ each: true, message: 'Danh sách bệnh mãn tính không hợp lệ' })
  chronicConditions?: string[];
}
