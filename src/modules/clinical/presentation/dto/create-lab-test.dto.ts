import { IsString } from 'class-validator';

export class CreateLabTestDto {
  @IsString()
  testName: string;
}
