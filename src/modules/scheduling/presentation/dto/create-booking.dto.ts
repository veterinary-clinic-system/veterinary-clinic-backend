import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CommonSymptom } from '@/shared/common/enums/common-symptom.enum';
import { CreatePetInlineDto } from './create-pet-inline.dto';

/**
 * The public booking form (Guest or logged-in PetOwner). Branch must be chosen before
 * doctor - enforced in AppointmentsService by validating `doctorId` belongs to
 * `branchId`, not just at the DTO level. Exactly one of `petId` (existing pet, e.g. from
 * a returning owner or the pet-profile "book appointment" shortcut) or `newPet` (first
 * booking for this pet) must be supplied.
 */
export class CreateBookingDto {
  @IsPhoneNumber('VN')
  phone: string;

  @ValidateIf((dto) => !dto.petId)
  @IsString()
  ownerFullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @ValidateIf((dto) => !dto.newPet)
  @IsUUID()
  petId?: string;

  @ValidateIf((dto) => !dto.petId)
  @ValidateNested()
  @Type(() => CreatePetInlineDto)
  newPet?: CreatePetInlineDto;

  @IsUUID()
  branchId: string;

  @IsUUID()
  doctorId: string;

  @IsUUID()
  serviceId: string;

  @IsDateString()
  startAt: string;

  @IsOptional()
  @IsArray()
  @IsEnum(CommonSymptom, { each: true })
  commonSymptoms?: CommonSymptom[];

  @IsOptional()
  @IsString()
  otherSymptoms?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsString()
  address?: string;
}
