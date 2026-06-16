import { BadRequestException } from '@nestjs/common';
import { Equipment } from 'src/equipment/entities/equipment.entity';

export type HitchPosition = 'lead' | 'rear';

function isRearHitch(e: Pick<Equipment, 'hitchPosition'>): boolean {
  return e.hitchPosition === 'rear';
}

function othersOnUnit(
  rows: Equipment[],
  unitId: number,
  excludeEquipmentId?: number,
): Equipment[] {
  return rows.filter(
    (e) => e.unitId === unitId && e.id !== excludeEquipmentId,
  );
}

/**
 * Valida cupo y posición de enganche en servidor (evita carreras entre dos usuarios).
 */
export function assertEquipmentHitchAssignmentAllowed(params: {
  unitId: number | null | undefined;
  hitchPosition: HitchPosition | null | undefined;
  isSecondTrailer: boolean;
  othersOnUnit: Equipment[];
  excludeEquipmentId?: number;
}): void {
  const unitId = params.unitId;
  if (unitId == null) {
    return;
  }

  const others = othersOnUnit(params.othersOnUnit, unitId, params.excludeEquipmentId);
  const rearOther = others.find(isRearHitch);
  const leadOther = others.find((e) => !isRearHitch(e));
  const isSecond = params.isSecondTrailer || params.hitchPosition === 'rear';

  if (others.length >= 2) {
    throw new BadRequestException(
      'La tractora ya tiene dos equipos enganchados (convoy full). Desenganche uno antes de continuar.',
    );
  }

  if (isSecond) {
    if (others.length === 0) {
      throw new BadRequestException(
        'Solo hay cupo para primer equipo en esta tractora.',
      );
    }
    if (rearOther) {
      throw new BadRequestException(
        'Ya hay un segundo equipo configurado en esta tractora.',
      );
    }
    return;
  }

  if (others.length === 0) {
    return;
  }

  if (leadOther) {
    throw new BadRequestException(
      'Ya hay un primer equipo en esta tractora. Use posición trasera o desenganche el otro equipo.',
    );
  }
}
