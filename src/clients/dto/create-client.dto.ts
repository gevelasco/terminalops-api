import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClientBillingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceLegalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxRegime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fiscalZip?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cfdiUse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingPhone?: string;
}

export class CreateClientPaymentTermsDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hasCredit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  creditDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approximateCreditAmount?: string;

  @ApiPropertyOptional({ default: 'not_evaluated' })
  @IsOptional()
  @IsString()
  commercialHealth?: string;
}

export class CreateClientContactDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateClientDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rfc?: string;

  @ApiPropertyOptional({ description: 'ISO date YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  relationshipStartedOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: CreateClientBillingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClientBillingDto)
  billing?: CreateClientBillingDto;

  @ApiPropertyOptional({ type: CreateClientPaymentTermsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClientPaymentTermsDto)
  payment?: CreateClientPaymentTermsDto;

  @ApiPropertyOptional({ type: [CreateClientContactDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClientContactDto)
  contacts?: CreateClientContactDto[];
}
