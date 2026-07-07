import { buildUnitOperationalId } from 'src/common/utils/unit-operational-id.util';
import type { Unit } from 'src/units/entities/unit.entity';

export type UnitLinkOptionDto = {
  id: number;
  operationalCode: string;
  status: string;
  isActive: boolean;
};

export function mapUnitLinkOption(unit: Unit): UnitLinkOptionDto {
  return {
    id: unit.id,
    operationalCode: buildUnitOperationalId(unit),
    status: unit.status,
    isActive: unit.isActive !== false,
  };
}
