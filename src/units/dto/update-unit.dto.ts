import { PartialType } from '@nestjs/swagger';
import { CreateUnitDto } from './create-unit.dto';

/** PATCH unidad: `status` no es editable (system-owned). */
export class UpdateUnitDto extends PartialType(CreateUnitDto) {}
