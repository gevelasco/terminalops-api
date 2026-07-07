import { PartialType } from '@nestjs/swagger';
import { CreateOperatorDto } from './create-operator.dto';

/** PATCH operador: `status` no es editable (system-owned). */
export class UpdateOperatorDto extends PartialType(CreateOperatorDto) {}
