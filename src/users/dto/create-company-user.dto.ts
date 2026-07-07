import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { STAFF_GRANTABLE_MODULE_CODES } from 'src/common/constants/app-modules';
import { ModuleGrantDto } from './module-grant.dto';

export class CreateCompanyUserDto {
  @ApiProperty({ example: 'jperez' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoDataUrl?: string;

  @ApiProperty({ enum: ['admin', 'staff'] })
  @IsIn(['admin', 'staff'])
  role: 'admin' | 'staff';

  @ApiPropertyOptional({
    type: [String],
    enum: STAFF_GRANTABLE_MODULE_CODES,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...STAFF_GRANTABLE_MODULE_CODES], { each: true })
  moduleCodes?: (typeof STAFF_GRANTABLE_MODULE_CODES)[number][];

  @ApiPropertyOptional({
    type: [ModuleGrantDto],
    description: 'Permisos por módulo con nivel lectura o escritura.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleGrantDto)
  moduleGrants?: ModuleGrantDto[];
}
