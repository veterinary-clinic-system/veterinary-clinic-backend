import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateBreedDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  breedName: string;
}
