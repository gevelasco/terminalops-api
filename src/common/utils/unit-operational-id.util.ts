import type { Unit } from 'src/units/entities/unit.entity';
import type { Equipment } from 'src/equipment/entities/equipment.entity';

type FleetOperationalCodeParts = {
  id: number;
  trailerBrandAbbr?: string;
  trailerYear?: string;
  plate?: string;
};

function normalizePlateForFleetId(plate: string): string {
  return plate.trim().replace(/\s+/g, '-');
}

function buildFleetOperationalCode(parts: FleetOperationalCodeParts): string {
  const abbr = (parts.trailerBrandAbbr ?? '').trim().toUpperCase();
  const year = (parts.trailerYear ?? '').trim();
  const plate = normalizePlateForFleetId(parts.plate ?? '');
  if (abbr && year && plate) {
    return `${abbr}-${year}-${plate}`;
  }
  return String(parts.id);
}

/** Código operativo visible: `MARCA-AÑO-PLACA` (ej. `HYU-2021-81-AA-9K`). */
export function buildUnitOperationalId(
  unit: Pick<Unit, 'trailerBrandAbbr' | 'trailerYear' | 'plate' | 'id'>,
): string {
  return buildFleetOperationalCode(unit);
}

/** Mismo criterio que unidad: `MARCA-AÑO-PLACA` (no alias ni id interno). */
export function buildEquipmentOperationalId(
  equipment: Pick<Equipment, 'trailerBrandAbbr' | 'trailerYear' | 'plate' | 'id'>,
): string {
  return buildFleetOperationalCode(equipment);
}
