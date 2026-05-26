import { IsString, MinLength } from 'class-validator';

export class UpdateUserPasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
