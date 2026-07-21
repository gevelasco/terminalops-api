export const ACTUAL_SCHEDULE_FIELD_KEYS = [
  'departureAt',
  'arrivedAt',
  'returnAt',
] as const;

export type ActualScheduleFieldKey = (typeof ACTUAL_SCHEDULE_FIELD_KEYS)[number];

export const ACTUAL_SCHEDULE_FIELD_LABELS: Record<ActualScheduleFieldKey, string> = {
  departureAt: 'Salida',
  arrivedAt: 'Llegada cliente',
  returnAt: 'Fin',
};

export const ACTUAL_SCHEDULE_ALLOWED_BODY_KEYS = new Set([
  'departureAt',
  'arrivedAt',
  'returnAt',
  'justification',
]);
