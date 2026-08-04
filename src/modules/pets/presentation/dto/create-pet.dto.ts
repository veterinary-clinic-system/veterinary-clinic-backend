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

/**
 * Staff adding a pet profile to an *existing* owner (Section 4.1.1). Distinct from
 * `CreatePetInlineDto` in appointments/, which is for a pet created inline during a
 * first-time public booking - that flow is owned by the appointments module.
 *
 * `speciesId` la BAT BUOC theo muc 16 SRS ("Species required"). Loai duoc gui KEM giong
 * chu khong suy ra tu `breedId`: nho vay `PetsService` doi chieu duoc hai gia tri voi
 * nhau va chan truong hop giao dien doi loai sang "Mèo" nhung van giu giong "Poodle"
 * cua lan chon truoc.
 */
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

  /** So microchip (FR-04-01) - duy nhat trong toan he thong, xem `uq_pets_microchip_id`. */
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

  /** Free-text flags per Section 4.1.1 ("Flag special info: drug allergies, chronic conditions"). */
  @IsOptional()
  @IsArray({ message: 'Danh sách dị ứng không hợp lệ' })
  @IsString({ each: true, message: 'Danh sách dị ứng không hợp lệ' })
  allergies?: string[];

  @IsOptional()
  @IsArray({ message: 'Danh sách bệnh mãn tính không hợp lệ' })
  @IsString({ each: true, message: 'Danh sách bệnh mãn tính không hợp lệ' })
  chronicConditions?: string[];
}
