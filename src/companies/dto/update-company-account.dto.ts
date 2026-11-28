import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCompanyAccountDto {
  @ApiPropertyOptional({ example: 'Transportes Ejemplo' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Operaciones logísticas' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  /** Data URL del logo (vacío = quitar). */
  @ApiPropertyOptional({
    description: 'Data URL JPEG/PNG del logo; string vacío para eliminar',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_500_000)
  logoDataUrl?: string;

  /** Correo de contacto comercial (cotizaciones); vacío = quitar. */
  @ApiPropertyOptional({ example: 'contacto@empresa.com' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @ValidateIf((_, v) => typeof v === 'string' && v.trim() !== '')
  @IsEmail()
  contactEmail?: string;

  /** Teléfono de contacto comercial (cotizaciones); vacío = quitar. */
  @ApiPropertyOptional({ example: '+52 55 1234 5678' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;
}
