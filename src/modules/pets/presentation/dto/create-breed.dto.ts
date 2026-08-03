import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Breed reference data is append-only, always created under a parent Species. */
export class CreateBreedDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  breedName: string;
}
