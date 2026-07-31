import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO HTTP (si se expone). El plan/licencia NO se aceptan del cliente:
 * solo se asignan en sign-up / activate-pro dentro del servicio.
 */
export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalName?: string;
}

/** Input interno de alta (sign-up). */
export type CreateCompanyInput = CreateCompanyDto & {
  subscriptionPlan?: 'basic' | 'standard' | 'pro';
  subscriptionEndsAt?: Date;
};
