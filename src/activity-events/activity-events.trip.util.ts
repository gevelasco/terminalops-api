import { COMPANY_ACTIVITY_KIND } from './company-activity-event.kinds';

/** Campos de programación / seguimiento que cuentan como cambio de fechas. */
const SCHEDULE_PATCH_KEYS = new Set([
  'plannedDepartureAt',
  'plannedArrivalAt',
  'plannedCompletionAt',
  'loadDate',
  'plannedDatesJustification',
  'emptyDeliveryAt',
  'emptyDeliveryPlace',
  'emptyDeliveryJustification',
]);

export function tripActivitySubjectLabel(
  maneuverCode: string | null | undefined,
  tripId: number,
  clientName?: string | null,
): string {
  const code = maneuverCode?.trim() || `M-${tripId}`;
  const client = clientName?.trim();
  return client ? `${code} · ${client}` : code;
}

export function tripPatchActivity(dto: object): {
  kind: string;
  title: string;
} {
  const keys = Object.entries(dto as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
  const onlySchedule =
    keys.length > 0 && keys.every((key) => SCHEDULE_PATCH_KEYS.has(key));
  if (onlySchedule) {
    return {
      kind: COMPANY_ACTIVITY_KIND.TRIP_TRACKING_UPDATED,
      title: 'Actualización de fechas',
    };
  }
  return {
    kind: COMPANY_ACTIVITY_KIND.TRIP_UPDATED,
    title: 'Datos de maniobra',
  };
}

export const TRIP_DOCUMENT_ADDED_ACTIVITY = {
  kind: COMPANY_ACTIVITY_KIND.TRIP_DOCUMENT_ADDED,
  title: 'Documento agregado',
} as const;

export const TRIP_TRACKING_UPDATED_ACTIVITY = {
  kind: COMPANY_ACTIVITY_KIND.TRIP_TRACKING_UPDATED,
  title: 'Actualización de fechas',
} as const;
