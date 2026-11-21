import { BadRequestException } from '@nestjs/common';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { isDollyEquipment, isDollyEquipmentType } from 'src/equipment/equipment-dolly.util';

export type HitchPosition = 'lead' | 'rear';

/**
 * Solo los tractocamiones llevan remolques/equipos enganchados. Unidades sin
 * tipo (legado) se tratan como tractocamión.
 */
export function assertUnitCanHitchEquipment(
  transportType: string | null | undefined,
): void {
  const t = transportType?.trim();
  if (t && t !== 'tractocamion') {
    throw new BadRequestException(
      'Solo las unidades tipo tractocamión pueden llevar remolques o equipos enganchados.',
    );
  }
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

function isRearTrailer(e: Equipment): boolean {
  return e.hitchPosition === 'rear' && !isDollyEquipment(e);
}

function isLeadTrailer(e: Equipment): boolean {
  if (isDollyEquipment(e)) {
    return false;
  }
  return e.hitchPosition === 'lead';
}

/**
 * Valida cupo y posición de enganche en servidor (evita carreras entre dos usuarios).
 * Convoy estándar: lead + rear. Con dolly: hasta lead + dolly + rear (3 equipos).
 */
export function assertEquipmentHitchAssignmentAllowed(params: {
  unitId: number | null | undefined;
  hitchPosition: HitchPosition | null | undefined;
  isSecondTrailer: boolean;
  othersOnUnit: Equipment[];
  excludeEquipmentId?: number;
  equipmentType?: string | null;
}): void {
  const unitId = params.unitId;
  if (unitId == null) {
    return;
  }

  const others = othersOnUnit(
    params.othersOnUnit,
    unitId,
    params.excludeEquipmentId,
  );
  const isRear =
    params.isSecondTrailer || params.hitchPosition === 'rear';
  const addingDolly = isDollyEquipmentType(params.equipmentType);

  const lead = others.find(isLeadTrailer);
  const rearTrailer = others.find(isRearTrailer);
  const dolly = others.find(isDollyEquipment);

  const allowsThirdRearTrailer =
    isRear &&
    !addingDolly &&
    lead != null &&
    dolly != null &&
    rearTrailer == null &&
    others.length === 2;

  if (others.length >= 3) {
    throw new BadRequestException(
      'La tractora ya tiene el convoy completo (máx. 3 equipos con dolly intermedio). Desenganche uno antes de continuar.',
    );
  }

  if (others.length === 2 && !allowsThirdRearTrailer) {
    throw new BadRequestException(
      'La tractora ya tiene dos equipos enganchados (convoy full). Desenganche uno antes de continuar.',
    );
  }

  if (addingDolly) {
    if (others.length === 0) {
      throw new BadRequestException(
        'El dolly solo puede engancharse entre dos equipos. Enganche primero el 1.er chasis o plataforma.',
      );
    }
    if (dolly) {
      throw new BadRequestException(
        'Esta tractora ya tiene un dolly enganchado.',
      );
    }
    if (!isRear) {
      throw new BadRequestException(
        'El dolly debe engancharse detrás del 1.er equipo (posición trasera en convoy).',
      );
    }
    if (rearTrailer) {
      throw new BadRequestException(
        'Ya hay un remolque trasero en esta tractora.',
      );
    }
    return;
  }

  if (isRear) {
    if (others.length === 0) {
      throw new BadRequestException(
        'Solo hay cupo para primer equipo en esta tractora.',
      );
    }
    if (rearTrailer && !allowsThirdRearTrailer) {
      throw new BadRequestException(
        'Ya hay un segundo equipo configurado en esta tractora.',
      );
    }
    return;
  }

  if (others.length === 0) {
    return;
  }

  if (lead) {
    throw new BadRequestException(
      'Ya hay un primer equipo en esta tractora. Use posición trasera o desenganche el otro equipo.',
    );
  }
}