import { BadRequestException } from '@nestjs/common';
import type { CreateTripDto } from '../dto/create-trip.dto';
import type { Trip } from '../entities/trip.entity';

export const REQUIRED_PLANNED_SCHEDULE_MESSAGE =
  'Trip creation requires planned departure, arrival and completion dates';

export const INVALID_PLANNED_SCHEDULE_ORDER_MESSAGE =
  'El plan debe cumplir: salida < llegada < fin de maniobra.';

export const MISSING_PLANNED_FIELDS_REASON = 'missing_planned_fields';

export interface ResolvedPlannedSchedule {
  plannedDepartureAt: Date;
  plannedArrivalAt: Date;
  plannedCompletionAt: Date;
}

export interface PlannedSchedulePatch {
  plannedDepartureAt?: string;
  plannedArrivalAt?: string;
  plannedCompletionAt?: string;
}

/**
 * Contrato estricto de creación: solo acepta plannedDepartureAt, plannedArrivalAt
 * y plannedCompletionAt explícitos. Sin inferencias ni fallbacks legacy.
 */
export function parseRequiredPlannedScheduleFromCreateDto(
  dto: CreateTripDto,
): ResolvedPlannedSchedule {
  if (
    !hasNonEmptyDateString(dto.plannedDepartureAt) ||
    !hasNonEmptyDateString(dto.plannedArrivalAt) ||
    !hasNonEmptyDateString(dto.plannedCompletionAt)
  ) {
    throw new BadRequestException(REQUIRED_PLANNED_SCHEDULE_MESSAGE);
  }

  const plannedDepartureAt = parseRequiredDate(
    dto.plannedDepartureAt,
    'plannedDepartureAt',
  );
  const plannedArrivalAt = parseRequiredDate(
    dto.plannedArrivalAt,
    'plannedArrivalAt',
  );
  const plannedCompletionAt = parseRequiredDate(
    dto.plannedCompletionAt,
    'plannedCompletionAt',
  );

  assertPlannedScheduleOrder(
    plannedDepartureAt,
    plannedArrivalAt,
    plannedCompletionAt,
  );

  return { plannedDepartureAt, plannedArrivalAt, plannedCompletionAt };
}

/** @deprecated Use parseRequiredPlannedScheduleFromCreateDto */
export const resolvePlannedScheduleFromCreateDto =
  parseRequiredPlannedScheduleFromCreateDto;

/**
 * Valida coherencia al actualizar campos planificados (parcial o completo).
 * Requiere que el plan resultante tenga las tres fechas y orden estricto.
 */
export function validatePlannedScheduleUpdate(
  trip: Pick<
    Trip,
    'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt'
  >,
  patch: PlannedSchedulePatch,
): Partial<ResolvedPlannedSchedule> {
  const hasPatch =
    patch.plannedDepartureAt !== undefined ||
    patch.plannedArrivalAt !== undefined ||
    patch.plannedCompletionAt !== undefined;

  if (!hasPatch) {
    return {};
  }

  const plannedDepartureAt =
    patch.plannedDepartureAt !== undefined
      ? parseRequiredDate(patch.plannedDepartureAt, 'plannedDepartureAt')
      : trip.plannedDepartureAt;
  const plannedArrivalAt =
    patch.plannedArrivalAt !== undefined
      ? parseRequiredDate(patch.plannedArrivalAt, 'plannedArrivalAt')
      : trip.plannedArrivalAt;
  const plannedCompletionAt =
    patch.plannedCompletionAt !== undefined
      ? parseRequiredDate(patch.plannedCompletionAt, 'plannedCompletionAt')
      : trip.plannedCompletionAt;

  if (!plannedDepartureAt || !plannedArrivalAt || !plannedCompletionAt) {
    throw new BadRequestException(REQUIRED_PLANNED_SCHEDULE_MESSAGE);
  }

  assertPlannedScheduleOrder(
    plannedDepartureAt,
    plannedArrivalAt,
    plannedCompletionAt,
  );

  return {
    ...(patch.plannedDepartureAt !== undefined && { plannedDepartureAt }),
    ...(patch.plannedArrivalAt !== undefined && { plannedArrivalAt }),
    ...(patch.plannedCompletionAt !== undefined && { plannedCompletionAt }),
  };
}

export function assertPlannedScheduleOrder(
  departure: Date,
  arrival: Date,
  completion: Date,
): void {
  if (!(departure < arrival && arrival < completion)) {
    throw new BadRequestException(INVALID_PLANNED_SCHEDULE_ORDER_MESSAGE);
  }
}

function hasNonEmptyDateString(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function parseRequiredDate(value: string, field: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(
      `Invalid date for ${field}: Trip creation requires planned departure, arrival and completion dates`,
    );
  }
  return d;
}
