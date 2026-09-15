import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Self-service registration for a PetOwner. If `phone` already belongs to an
 * account auto-created by a guest booking (Section 4's "no login required to book"
 * flow, prompt.md), this sets the password on that existing account instead of
 * creating a duplicate - see AuthService.registerPetOwner.
 */
export class RegisterPetOwnerDto {
  @IsString()
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
