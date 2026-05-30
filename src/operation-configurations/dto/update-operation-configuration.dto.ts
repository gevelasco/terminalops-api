import { PartialType } from '@nestjs/swagger';
import { CreateOperationConfigurationDto } from './create-operation-configuration.dto';

export class UpdateOperationConfigurationDto extends PartialType(
  CreateOperationConfigurationDto,
) {}
