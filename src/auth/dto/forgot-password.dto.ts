import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'correo@empresa.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
