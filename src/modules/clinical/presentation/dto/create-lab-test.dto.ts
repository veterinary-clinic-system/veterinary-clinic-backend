import { IsString } from 'class-validator';

/** Section 4.1.4: "order lab tests" - status starts at ORDERED, result added later via PATCH. */
export class CreateLabTestDto {
  @IsString()
  testName: string;
}
