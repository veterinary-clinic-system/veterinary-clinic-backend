import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CommonSymptom } from '@/shared/common/enums/common-symptom.enum';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { CreatePetInlineDto } from './create-pet-inline.dto';

/**
 * Khach den truc tiep khong dat lich. Giong `CreateBookingDto` o phan giai quyet chu +
 * thu cung, nhung KHONG co `startAt`: khong ai chon khung gio cho khach vang lai - ho
 * vao hang cho, va khung gio chi duoc chot khi gan bac si.
 *
 * `doctorId` la tuy chon: le tan co the gan bac si ngay neu da biet ai ranh, hoac de
 * trong va gan sau tu man hinh hang cho.
 */
export class CreateWalkInDto {
  @IsUUID()
  branchId: string;

  @IsUUID()
  serviceId: string;

  /**
   * Bo trong = le tan khong chi dinh ai. Khi do he thong TU tim mot bac si con khung
   * gio trong trong hom nay va xep luon; chi khi ca chi nhanh het cho thi luot moi
   * nam lai o hang cho. Xem `QueueService.createWalkIn`.
   */
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsPhoneNumber('VN')
  phone: string;

  @ValidateIf((dto) => !dto.petId)
  @IsString()
  ownerFullName?: string;

  @ValidateIf((dto) => !dto.newPet)
  @IsUUID()
  petId?: string;

  @ValidateIf((dto) => !dto.petId)
  @ValidateNested()
  @Type(() => CreatePetInlineDto)
  newPet?: CreatePetInlineDto;

  @IsOptional()
  @IsEnum(PriorityColor)
  priorityColor?: PriorityColor;

  @IsOptional()
  @IsArray()
  @IsEnum(CommonSymptom, { each: true })
  commonSymptoms?: CommonSymptom[];

  /** Ly do den kham, khach tu ke. */
  @IsOptional()
  @IsString()
  reason?: string;

  /** Ghi chu noi bo cua le tan. */
  @IsOptional()
  @IsString()
  note?: string;

  /** Anh trieu chung - giong bieu mau dat lich cong khai. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  photoUrls?: string[];
}
