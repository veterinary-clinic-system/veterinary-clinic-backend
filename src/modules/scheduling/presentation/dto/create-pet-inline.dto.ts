import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Gender } from '@/shared/common/enums/gender.enum';

export class CreatePetInlineDto {
  @IsString({ message: 'Vui lòng nhập tên thú cưng' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên thú cưng' })
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
  weight?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  birthDate?: string;
}
