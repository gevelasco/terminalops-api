import { buildEquipmentOperationalId } from 'src/common/utils/unit-operational-id.util';
import type { Equipment } from 'src/equipment/entities/equipment.entity';

export type EquipmentLinkOptionDto = {
  id: number;
  operationalCode: string;
  status: string;
  isActive: boolean;
};

export function mapEquipmentLinkOption(
  equipment: Equipment,
): EquipmentLinkOptionDto {
  return {
    id: equipment.id,
    operationalCode: buildEquipmentOperationalId(equipment),
    status: equipment.status ?? '',
    isActive: equipment.isActive !== false,
  };
}
