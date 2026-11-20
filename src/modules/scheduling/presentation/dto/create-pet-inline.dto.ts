import { Transform } from 'class-transformer';
import {
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
import {
  PET_MAX_WEIGHT_KG,
  PET_MIN_WEIGHT_KG,
  PET_NAME_MAX_LENGTH,
} from '@/shared/common/validation/pet-limits';
import { Gender } from '@/shared/common/enums/gender.enum';

export class CreatePetInlineDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Vui lòng nhập tên thú cưng' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên thú cưng' })
  @MaxLength(PET_NAME_MAX_LENGTH, {
    message: `Tên thú cưng không được vượt quá ${PET_NAME_MAX_LENGTH} ký tự`,
  })
  name: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'Loài không hợp lệ' })
  speciesId?: string;

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
}
