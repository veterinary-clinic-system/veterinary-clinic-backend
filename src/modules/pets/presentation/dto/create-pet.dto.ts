import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Gender } from '@/shared/common/enums/gender.enum';

/**
 * Staff adding a pet profile to an *existing* owner (Section 4.1.1). Distinct from
 * `CreatePetInlineDto` in appointments/, which is for a pet created inline during a
 * first-time public booking - that flow is owned by the appointments module.
 */
export class CreatePetDto {
  @IsUUID()
  ownerId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  breedId: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Free-text flags per Section 4.1.1 ("Flag special info: drug allergies, chronic conditions"). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chronicConditions?: string[];
}
