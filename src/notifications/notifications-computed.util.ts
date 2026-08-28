import { LEDGER_SCHEDULED_KIND_SET } from 'src/expenses/ledger-scheduled-kinds';
import type { ExpenseCalendarEntry } from 'src/expenses/expenses-calendar-projection.util';
import { NOTIFICATION_COMPUTED_KIND } from 'src/activity-events/company-activity-event.kinds';
import {
  classifyPaymentReminder,
  dueYmdToIso,
  paymentReminderEventKind,
  paymentReminderTitle,
  paymentReminderTone,
} from './payment-reminder.util';

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

const SCHEDULED_EXPENSE_KINDS = LEDGER_SCHEDULED_KIND_SET;

function paymentIcon(kind: string): string {
  switch (kind) {
    case 'insurance':
      return 'document';
    case 'gps':
      return 'tracking';
    case 'verification':
      return 'maintenance';
    case 'operator_payment':
    case 'operator_commission':
      return 'person';
    default:
      return 'settlement';
  }
}

export function buildComputedPaymentNotifications(
  items: readonly ExpenseCalendarEntry[],
  range: { today: string; soonUntil: string },
): NotificationFeedItemDto[] {
  const rows: NotificationFeedItemDto[] = [];

  for (const item of items) {
    if (item.statusLabel !== 'Vencido' && item.statusLabel !== 'Pendiente') {
      continue;
    }
    const kind = (item.kind ?? '').trim();
    if (kind && !SCHEDULED_EXPENSE_KINDS.has(kind)) {
      continue;
    }
    const dueYmd = (item.dateYmd || '').trim();
    const urgency = classifyPaymentReminder(dueYmd, range.today, range.soonUntil);
    if (!urgency) {
      continue;
    }

    rows.push({
      id: `computed:payment:${urgency}:${item.id}:${dueYmd}`,
      kind: paymentReminderEventKind(urgency),
      origin: 'computed',
      icon: paymentIcon(kind),
      title: paymentReminderTitle(kind, urgency),
      subjectLabel: item.conceptLabel || '—',
      occurredAt: dueYmdToIso(dueYmd),
      actorLabel: 'Sistema',
      tone: paymentReminderTone(urgency),
      entityType: 'expense',
      entityId: item.expenseId != null ? String(item.expenseId) : '',
    });
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
