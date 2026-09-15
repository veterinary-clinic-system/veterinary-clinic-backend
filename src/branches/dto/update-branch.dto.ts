import { IsBoolean, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

/** Admin-only edit of an existing branch, including the `active` soft-delete flag. */
export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  branchName?: string;

  @IsOptional()
  @IsPhoneNumber('VN')
  phone?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  address?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
