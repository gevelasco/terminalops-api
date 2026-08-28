import { COMPANY_ACTIVITY_KIND } from './company-activity-event.kinds';

const EMPTY_DELIVERY_PATCH_KEYS = new Set([
  'emptyDeliveryAt',
  'emptyDeliveryPlace',
  'emptyDeliveryJustification',
]);

export function tripActivitySubjectLabel(
  maneuverCode: string | null | undefined,
  tripId: number,
): string {
  return maneuverCode?.trim() || `M-${tripId}`;
}

export function tripPatchActivity(dto: object): {
  kind: string;
  title: string;
} {
  const keys = Object.entries(dto as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
  const onlyEmptyDelivery =
    keys.length > 0 && keys.every((key) => EMPTY_DELIVERY_PATCH_KEYS.has(key));
  if (onlyEmptyDelivery) {
    return {
      kind: COMPANY_ACTIVITY_KIND.TRIP_TRACKING_UPDATED,
      title: 'Seguimiento',
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
  title: 'Seguimiento',
} as const;
