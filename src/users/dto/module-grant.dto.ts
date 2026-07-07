import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  STAFF_GRANTABLE_MODULE_CODES,
  type ModuleAccessLevel,
} from 'src/common/constants/app-modules';

export class ModuleGrantDto {
  @ApiProperty({ enum: STAFF_GRANTABLE_MODULE_CODES })
  @IsIn([...STAFF_GRANTABLE_MODULE_CODES])
  module: (typeof STAFF_GRANTABLE_MODULE_CODES)[number];

  @ApiProperty({ enum: ['read', 'write'] })
  @IsIn(['read', 'write'])
  level: ModuleAccessLevel;
}
