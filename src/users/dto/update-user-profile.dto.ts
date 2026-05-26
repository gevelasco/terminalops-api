import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  photoDataUrl?: string;

  @IsOptional()
  @IsIn(['light', 'dark'])
  theme?: 'light' | 'dark';
}
