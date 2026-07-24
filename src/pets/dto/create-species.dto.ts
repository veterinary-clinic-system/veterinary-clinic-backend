import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Species reference data is append-only (Section scope note: no update/delete). */
export class CreateSpeciesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  speciesName: string;
}
