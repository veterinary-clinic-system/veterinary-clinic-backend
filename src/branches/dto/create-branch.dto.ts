import { IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

/** Admin-only creation of a new clinic branch. */
export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  branchName: string;

  @IsPhoneNumber('VN')
  phone: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(5)
  address: string;
}
