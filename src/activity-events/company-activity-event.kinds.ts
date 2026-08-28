/** Tipos persistidos en company_activity_events (eventos de mutación). */
export const COMPANY_ACTIVITY_KIND = {
  BITACORA_MESSAGE: 'bitacora.message',
  INCIDENT_REPORTED: 'incident.reported',
  UNIT_CREATED: 'unit.created',
  EQUIPMENT_CREATED: 'equipment.created',
  CLIENT_CREATED: 'client.created',
  COVERAGE_PAYMENT_CONFIRMED: 'coverage.payment_confirmed',
  PAYMENT_CONFIRMED: 'payment.confirmed',
  PAYMENT_REVERTED: 'payment.reverted',
  EXPENSE_MANUAL_CREATED: 'expense.manual_created',
  EXPENSE_UPDATED: 'expense.updated',
  CLIENT_UPDATED: 'client.updated',
  TRIP_UPDATED: 'trip.updated',
  TRIP_EXPENSE_ADDED: 'trip.expense_added',
  TRIP_DOCUMENT_ADDED: 'trip.document_added',
  TRIP_TRACKING_UPDATED: 'trip.tracking_updated',
  OPERATOR_UPDATED: 'operator.updated',
  UNIT_UPDATED: 'unit.updated',
  UNIT_FICHA_UPDATED: 'unit.ficha_updated',
  UNIT_COVERAGE_UPDATED: 'unit.coverage_updated',
  UNIT_MAINTENANCE_UPDATED: 'unit.maintenance_updated',
  EQUIPMENT_UPDATED: 'equipment.updated',
  EQUIPMENT_FICHA_UPDATED: 'equipment.ficha_updated',
  EQUIPMENT_COVERAGE_UPDATED: 'equipment.coverage_updated',
  EQUIPMENT_MAINTENANCE_UPDATED: 'equipment.maintenance_updated',
} as const;

export type CompanyActivityKind =
  (typeof COMPANY_ACTIVITY_KIND)[keyof typeof COMPANY_ACTIVITY_KIND];

/** Ítems calculados al leer (no se persisten). */
export const NOTIFICATION_COMPUTED_KIND = {
  PAYMENT_OVERDUE: 'payment.overdue',
  PAYMENT_DUE_TODAY: 'payment.due_today',
  PAYMENT_DUE_SOON: 'payment.due_soon',
  RECEIVABLE_DUE: 'receivable.due',
} as const;

export type NotificationComputedKind =
  (typeof NOTIFICATION_COMPUTED_KIND)[keyof typeof NOTIFICATION_COMPUTED_KIND];
