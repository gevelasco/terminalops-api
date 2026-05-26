import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @ApiProperty({ example: 'Grupo VSC' })
  @IsString()
  @MinLength(2)
  companyName: string;

  @ApiProperty({ example: 'Germán' })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({ example: 'Velasco' })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiProperty({ example: 'gvelasco' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'admin@grupovsc.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '8181234567' })
  @IsString()
  @MinLength(7)
  phone: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Código de invitación requerido para registrar una empresa',
    example: 'VSC-GRUPO-2026-A',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código de invitación es obligatorio' })
  invitationCode: string;
}
