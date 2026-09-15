import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

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
