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

/**
 * Pet fields collected inline during a first-time booking (Section 4.1.2).
 *
 * `speciesId` la TUY CHON o day (khac `CreatePetDto` cua quay le tan, noi no bat buoc):
 * bieu mau dat lich cong khai da co san o chon Loai, nhung mot client cu chi gui
 * `breedId` van phai dat lich duoc. Khi CO gui thi giong phai thuoc dung loai do -
 * `PartyResolverService.resolvePet` doi chieu (muc 16 SRS).
 */
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
