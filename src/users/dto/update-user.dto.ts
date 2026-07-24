import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Admin edits to an existing staff/pet-owner account. `role` and `phone` are
 * intentionally not accepted here - swapping either is a "create a new account"
 * operation, not an update; the global `ValidationPipe({ whitelist: true })` silently
 * strips any extra fields a client sends that aren't declared below.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
