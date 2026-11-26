import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertTollPlazaAliasDto {
  @ApiProperty({ description: 'Clave de caseta (`plazaKey`, p. ej. plaza:123)' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  plazaKey: string;

  @ApiProperty({ example: 'San Marcos' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  displayName: string;
}