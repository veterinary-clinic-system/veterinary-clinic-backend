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

export class CreateWalkInDto {
  @IsUUID()
  branchId: string;

  @IsUUID()
  serviceId: string;

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

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  photoUrls?: string[];
}
