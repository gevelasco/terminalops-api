/** Tipos persistidos en company_activity_events (eventos de mutación). */
export const COMPANY_ACTIVITY_KIND = {
  BITACORA_MESSAGE: 'bitacora.message',
  INCIDENT_REPORTED: 'incident.reported',
  UNIT_CREATED: 'unit.created',
  EQUIPMENT_CREATED: 'equipment.created',
  CLIENT_CREATED: 'client.created',
  COVERAGE_PAYMENT_CONFIRMED: 'coverage.payment_confirmed',
  EXPENSE_MANUAL_CREATED: 'expense.manual_created',
  EXPENSE_UPDATED: 'expense.updated',
  CLIENT_UPDATED: 'client.updated',
  TRIP_UPDATED: 'trip.updated',
  OPERATOR_UPDATED: 'operator.updated',
  UNIT_UPDATED: 'unit.updated',
  EQUIPMENT_UPDATED: 'equipment.updated',
} as const;

export type CompanyActivityKind =
  (typeof COMPANY_ACTIVITY_KIND)[keyof typeof COMPANY_ACTIVITY_KIND];

/** Ítems calculados al leer (no se persisten). */
export const NOTIFICATION_COMPUTED_KIND = {
  PAYMENT_OVERDUE: 'payment.overdue',
  PAYMENT_DUE_TODAY: 'payment.due_today',
  RECEIVABLE_DUE: 'receivable.due',
} as const;

export type NotificationComputedKind =
  (typeof NOTIFICATION_COMPUTED_KIND)[keyof typeof NOTIFICATION_COMPUTED_KIND];
