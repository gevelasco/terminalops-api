import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ActivateProPlanDto {
  @ApiProperty({
    description:
      'Código de invitación de upgrade (plan y duración definidos en BD)',
    example: 'XXXX-XXXX-XXXX-XXXX',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código de invitación es obligatorio' })
  invitationCode: string;
}
