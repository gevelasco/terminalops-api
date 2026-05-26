import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Usuario o correo' })
  @IsString()
  login: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;
}
