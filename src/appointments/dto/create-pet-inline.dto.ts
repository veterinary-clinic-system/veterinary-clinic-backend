import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Gender } from '@/common/enums/gender.enum';

/** Pet fields collected inline during a first-time booking (Section 4.1.2). */
export class CreatePetInlineDto {
  @IsString()
  name: string;

  @IsString()
  breedId: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsDateString()
  birthDate?: string;
}
