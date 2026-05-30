import type { Unit } from 'src/units/entities/unit.entity';

function normalizePlateForFleetId(plate: string): string {
  return plate.trim().replace(/\s+/g, '-');
}

/** Código operativo visible: `MARCA-AÑO-PLACA` (ej. `HYU-2021-81-AA-9K`). */
export function buildUnitOperationalId(
  unit: Pick<Unit, 'trailerBrandAbbr' | 'trailerYear' | 'plate' | 'id'>,
): string {
  const abbr = (unit.trailerBrandAbbr ?? '').trim().toUpperCase();
  const year = (unit.trailerYear ?? '').trim();
  const plate = normalizePlateForFleetId(unit.plate ?? '');
  if (abbr && year && plate) {
    return `${abbr}-${year}-${plate}`;
  }
  return String(unit.id);
}
