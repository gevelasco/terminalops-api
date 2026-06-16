import { BadRequestException } from '@nestjs/common';
import type { ActualScheduleFieldKey } from './actual-schedule.constants';

export type ActualScheduleDateValues = {
  departureAt: Date | null;
  arrivedAt: Date | null;
  returnAt: Date | null;
};

export type ActualScheduleFieldDelta = {
  field: ActualScheduleFieldKey;
  previous: Date | null;
  next: Date;
};

export type ActualSchedulePlannedValues = {
  plannedDepartureAt: Date;
  plannedArrivalAt: Date;
  plannedCompletionAt: Date;
};

const FIELD_PLANNED: Record<
  ActualScheduleFieldKey,
  keyof ActualSchedulePlannedValues
> = {
  departureAt: 'plannedDepartureAt',
  arrivedAt: 'plannedArrivalAt',
  returnAt: 'plannedCompletionAt',
};

const MS_TOLERANCE = 1000;

export function rejectDisallowedActualScheduleBodyKeys(
  body: Record<string, unknown>,
): void {
  for (const key of Object.keys(body)) {
    if (
      key !== 'departureAt' &&
      key !== 'arrivedAt' &&
      key !== 'returnAt' &&
      key !== 'justification'
    ) {
      throw new BadRequestException(
        `Campo no permitido en actualización de cronograma real: ${key}`,
      );
    }
  }
}

export function parseOptionalIsoDate(
  value: string | undefined,
  field: string,
): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException(`Fecha inválida para ${field}.`);
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Fecha inválida para ${field}.`);
  }
  return d;
}

function sameInstant(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return Math.abs(a.getTime() - b.getTime()) < MS_TOLERANCE;
}

export function detectActualScheduleDeltas(
  current: ActualScheduleDateValues,
  incoming: Partial<Record<ActualScheduleFieldKey, Date>>,
): ActualScheduleFieldDelta[] {
  const deltas: ActualScheduleFieldDelta[] = [];
  for (const field of ['departureAt', 'arrivedAt', 'returnAt'] as const) {
    const next = incoming[field];
    if (next === undefined) {
      continue;
    }
    const previous = current[field];
    if (sameInstant(previous, next)) {
      continue;
    }
    deltas.push({ field, previous, next });
  }
  return deltas;
}

export function assertActualScheduleChronology(
  values: ActualScheduleDateValues,
  planned?: ActualSchedulePlannedValues,
): void {
  const { departureAt: dep, arrivedAt: arr, returnAt: ret } = values;
  const arrivalRef = arr ?? planned?.plannedArrivalAt ?? null;

  if (dep && arrivalRef && dep.getTime() >= arrivalRef.getTime()) {
    throw new BadRequestException(
      'El cronograma real debe cumplir: salida < llegada cliente.',
    );
  }
  if (arrivalRef && ret && arrivalRef.getTime() >= ret.getTime()) {
    throw new BadRequestException(
      'La fecha fin real no puede ser anterior a la llegada con cliente.',
    );
  }
  if (dep && ret && !arrivalRef && dep.getTime() >= ret.getTime()) {
    throw new BadRequestException(
      'El cronograma real debe cumplir: salida < fin.',
    );
  }
}

export function applyActualScheduleDeltas(
  current: ActualScheduleDateValues,
  deltas: ActualScheduleFieldDelta[],
): ActualScheduleDateValues {
  const next: ActualScheduleDateValues = { ...current };
  for (const delta of deltas) {
    next[delta.field] = delta.next;
  }
  return next;
}

export function formatActualScheduleMx(date: Date | null | undefined): string {
  if (!date) {
    return 'Sin registro';
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** En incidentes: sin fecha real previa, mostrar la planeada como referencia (1.er cambio). */
export function actualSchedulePreviousForIncidentDisplay(
  field: ActualScheduleFieldKey,
  previous: Date | null,
  planned: ActualSchedulePlannedValues,
): Date | null {
  if (previous) {
    return previous;
  }
  return planned[FIELD_PLANNED[field]] ?? null;
}
