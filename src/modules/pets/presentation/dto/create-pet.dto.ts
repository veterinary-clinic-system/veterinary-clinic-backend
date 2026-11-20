import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsNotFutureDate } from '@/shared/common/validation/is-not-future-date.validator';
import {
  IsRecentBirthDate,
  MAX_PET_AGE_YEARS,
} from '@/shared/common/validation/is-recent-birth-date.validator';
import { Gender } from '@/shared/common/enums/gender.enum';
import {
  PET_MAX_WEIGHT_KG,
  PET_MIN_WEIGHT_KG,
  PET_NAME_MAX_LENGTH,
} from '@/shared/common/validation/pet-limits';

export class CreatePetDto {
  @IsUUID(undefined, { message: 'Chủ nuôi không hợp lệ' })
  ownerId: string;

  // Cắt khoảng trắng TRƯỚC khi kiểm: "     " không được lọt qua IsNotEmpty thành bé không tên.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Vui lòng nhập tên thú cưng' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên thú cưng' })
  @MaxLength(PET_NAME_MAX_LENGTH, {
    message: `Tên thú cưng không được vượt quá ${PET_NAME_MAX_LENGTH} ký tự`,
  })
  name: string;

  @IsUUID(undefined, { message: 'Vui lòng chọn loài' })
  speciesId: string;

  @IsUUID(undefined, { message: 'Vui lòng chọn giống' })
  breedId: string;

  @IsEnum(Gender, { message: 'Giới tính không hợp lệ' })
  gender: Gender;

  @IsOptional()
  @IsNumber({}, { message: 'Cân nặng phải là số' })
  @Min(PET_MIN_WEIGHT_KG, { message: `Cân nặng phải từ ${PET_MIN_WEIGHT_KG} kg trở lên` })
  @Max(PET_MAX_WEIGHT_KG, { message: `Cân nặng không được vượt quá ${PET_MAX_WEIGHT_KG} kg` })
  weight?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  @IsNotFutureDate({ message: 'Ngày sinh không được sau hôm nay' })
  @IsRecentBirthDate({ message: `Ngày sinh không được cách đây quá ${MAX_PET_AGE_YEARS} năm` })
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
