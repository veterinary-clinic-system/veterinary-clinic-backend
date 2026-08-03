import { IsString, MinLength } from 'class-validator';

/** `PATCH /users/me/password` - any authenticated role changing their own password. */
export class UpdatePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
