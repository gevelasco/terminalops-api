import { PartialType } from '@nestjs/swagger';
import { CreateEquipmentDto } from './create-equipment.dto';

/** PATCH equipo: `status` no es editable (system-owned). */
export class UpdateEquipmentDto extends PartialType(CreateEquipmentDto) {}
