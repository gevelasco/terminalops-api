import type { ExpenseCalendarEntry, ProjectedExpenseRow } from 'src/expenses/expenses-calendar-projection.util';
import { NOTIFICATION_COMPUTED_KIND } from 'src/activity-events/company-activity-event.kinds';

export interface NotificationFeedItemDto {
  id: string;
  kind: string;
  origin: 'event' | 'computed';
  icon: string;
  title: string;
  subjectLabel: string;
  occurredAt: string;
  actorLabel: string;
  tone?: 'danger' | 'warning' | 'neutral';
  entityType?: string | null;
  entityId?: string | null;
  entityTab?: string | null;
}

const SCHEDULED_SOURCES = new Set([
  'insurance',
  'gps',
  'verification',
  'operator_payment',
]);

function trimLabel(value?: string | null): string {
  return value?.trim() ?? '';
}

function paymentSubjectLabel(projected: ProjectedExpenseRow): string {
  switch (projected.source) {
    case 'gps':
      return (
        trimLabel(projected.relatedUnitLabel) ||
        trimLabel(projected.fleetRelationLabel)
      );
    case 'insurance':
    case 'verification':
      return (
        trimLabel(projected.relatedUnitLabel) ||
        trimLabel(projected.relatedEquipmentLabel) ||
        trimLabel(projected.fleetRelationLabel)
      );
    case 'operator_payment':
      return trimLabel(projected.relatedOperatorLabel);
    default:
      return trimLabel(projected.fleetRelationLabel);
  }
}

function paymentTitle(projected: ProjectedExpenseRow, overdue: boolean): string {
  const prefix = (() => {
    switch (projected.source) {
      case 'gps':
        return 'Pago de GPS';
      case 'insurance':
        return 'Pago de seguro';
      case 'verification':
        return 'Pago de verificación';
      case 'operator_payment':
        return 'Pago a operador';
      default:
        return 'Pago programado';
    }
  })();
  return overdue ? `${prefix} vencido` : `${prefix} hoy`;
}

function paymentEntityTab(projected: ProjectedExpenseRow): string | null {
  if (projected.source !== 'gps' && projected.source !== 'insurance') {
    return null;
  }
  if (projected.relatedUnitId != null || projected.relatedEquipmentId != null) {
    return 'cob';
  }
  return null;
}

function paymentNavigationTarget(
  projected: ProjectedExpenseRow,
): { entityType: string; entityId: string } {
  if (projected.relatedUnitId != null) {
    return { entityType: 'unit', entityId: String(projected.relatedUnitId) };
  }
  if (projected.relatedEquipmentId != null) {
    return {
      entityType: 'equipment',
      entityId: String(projected.relatedEquipmentId),
    };
  }
  if (projected.relatedOperatorId != null) {
    return {
      entityType: 'operator',
      entityId: String(projected.relatedOperatorId),
    };
  }
  return { entityType: 'expenses', entityId: '' };
}

function paymentIcon(source: string): string {
  switch (source) {
    case 'insurance':
      return 'document';
    case 'gps':
      return 'tracking';
    case 'verification':
      return 'maintenance';
    case 'operator_payment':
      return 'person';
    default:
      return 'settlement';
  }
}

function dueYmdToIso(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) {
    return new Date().toISOString();
  }
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0,
  ).toISOString();
}

export function buildComputedPaymentNotifications(
  items: readonly ExpenseCalendarEntry[],
  range: { from: string; to: string; today: string },
): NotificationFeedItemDto[] {
  const rows: NotificationFeedItemDto[] = [];

  for (const item of items) {
    if (item.entryType !== 'projected' || !item.projected) {
      continue;
    }
    const projected = item.projected;
    if (projected.nature !== 'scheduled' || !SCHEDULED_SOURCES.has(projected.source)) {
      continue;
    }
    const dueYmd = (projected.dueDate || item.dateYmd || '').trim();
    if (!dueYmd) {
      continue;
    }

    const overdue = dueYmd < range.today;
    const dueToday = dueYmd === range.today;
    const inRange = dueYmd >= range.from && dueYmd <= range.to;

    if (overdue && inRange) {
      const nav = paymentNavigationTarget(projected);
      rows.push({
        id: `computed:payment:overdue:${projected.id}:${dueYmd}`,
        kind: NOTIFICATION_COMPUTED_KIND.PAYMENT_OVERDUE,
        origin: 'computed',
        icon: paymentIcon(projected.source),
        title: paymentTitle(projected, true),
        subjectLabel: paymentSubjectLabel(projected) || '—',
        occurredAt: dueYmdToIso(dueYmd),
        actorLabel: 'Sistema',
        tone: 'danger',
        entityType: nav.entityType,
        entityId: nav.entityId,
        entityTab: paymentEntityTab(projected),
      });
      continue;
    }

    if (dueToday && inRange) {
      const nav = paymentNavigationTarget(projected);
      rows.push({
        id: `computed:payment:today:${projected.id}:${dueYmd}`,
        kind: NOTIFICATION_COMPUTED_KIND.PAYMENT_DUE_TODAY,
        origin: 'computed',
        icon: paymentIcon(projected.source),
        title: paymentTitle(projected, false),
        subjectLabel: paymentSubjectLabel(projected) || '—',
        occurredAt: dueYmdToIso(dueYmd),
        actorLabel: 'Sistema',
        tone: 'warning',
        entityType: nav.entityType,
        entityId: nav.entityId,
        entityTab: paymentEntityTab(projected),
      });
    }
  }

  return rows;
}

export interface ReceivableDueRow {
  trip_id: number;
  maneuver_code: string;
  client_name: string;
  due_date: string;
}

export function buildReceivableDueNotifications(
  rows: readonly ReceivableDueRow[],
): NotificationFeedItemDto[] {
  return rows.map((row) => ({
    id: `computed:receivable:${row.trip_id}:${row.due_date}`,
    kind: NOTIFICATION_COMPUTED_KIND.RECEIVABLE_DUE,
    origin: 'computed',
    icon: 'settlement',
    title: 'Cuenta por cobrar',
    subjectLabel: row.client_name?.trim() || row.maneuver_code?.trim() || '—',
    occurredAt: dueYmdToIso(row.due_date),
    actorLabel: 'Sistema',
    tone: 'warning',
    entityType: 'trip',
    entityId: String(row.trip_id),
  }));
}
