import { LEDGER_SCHEDULED_KIND_SET } from 'src/expenses/ledger-scheduled-kinds';
import { NOTIFICATION_COMPUTED_KIND } from 'src/activity-events/company-activity-event.kinds';

export const PAYMENT_REMINDER_DAYS_MIN = 1;
export const PAYMENT_REMINDER_DAYS_MAX = 15;
export const PAYMENT_REMINDER_DAYS_DEFAULT = 5;

export type PaymentReminderUrgency = 'overdue' | 'today' | 'soon';

export function normalizePaymentReminderDays(raw: unknown): number {
  if (raw == null || raw === '') {
    return PAYMENT_REMINDER_DAYS_DEFAULT;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return PAYMENT_REMINDER_DAYS_DEFAULT;
  }
  const rounded = Math.round(n);
  if (rounded < PAYMENT_REMINDER_DAYS_MIN) {
    return PAYMENT_REMINDER_DAYS_MIN;
  }
  if (rounded > PAYMENT_REMINDER_DAYS_MAX) {
    return PAYMENT_REMINDER_DAYS_MAX;
  }
  return rounded;
}

export function classifyPaymentReminder(
  dueYmd: string,
  todayYmd: string,
  soonUntilYmd: string,
): PaymentReminderUrgency | null {
  const due = dueYmd.trim();
  if (!due) {
    return null;
  }
  if (due < todayYmd) {
    return 'overdue';
  }
  if (due === todayYmd) {
    return 'today';
  }
  if (due <= soonUntilYmd) {
    return 'soon';
  }
  return null;
}

export function paymentReminderEventKind(
  urgency: PaymentReminderUrgency,
): string {
  switch (urgency) {
    case 'overdue':
      return NOTIFICATION_COMPUTED_KIND.PAYMENT_OVERDUE;
    case 'today':
      return NOTIFICATION_COMPUTED_KIND.PAYMENT_DUE_TODAY;
    case 'soon':
      return NOTIFICATION_COMPUTED_KIND.PAYMENT_DUE_SOON;
  }
}

export function paymentReminderTitle(
  expenseKind: string,
  urgency: PaymentReminderUrgency,
): string {
  const prefix = (() => {
    switch (expenseKind) {
      case 'gps':
        return 'Pago de GPS';
      case 'insurance':
        return 'Pago de seguro';
      case 'verification':
        return 'Pago de verificación';
      case 'tenure_payment':
        return 'Cuota de financiamiento';
      case 'operator_payment':
      case 'operator_commission':
        return 'Pago a operador';
      default:
        return 'Pago programado';
    }
  })();
  if (urgency === 'overdue') {
    return `${prefix} vencido`;
  }
  if (urgency === 'today') {
    return `${prefix} hoy`;
  }
  return `${prefix} próximo`;
}

/** Una sola notificación por gasto + fecha de vencimiento (no por urgencia). */
export function paymentReminderDedupeKey(
  expenseId: number,
  dueYmd: string,
): string {
  return `payment-reminder:${expenseId}:${dueYmd}`;
}

export function isLedgerScheduledPaymentKind(kind: string): boolean {
  return LEDGER_SCHEDULED_KIND_SET.has(kind);
}

export function paymentReminderTone(
  urgency: PaymentReminderUrgency,
): 'danger' | 'warning' {
  return urgency === 'overdue' ? 'danger' : 'warning';
}

export function dueYmdToIso(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) {
    return new Date().toISOString();
  }
  // Mediodía UTC del YMD (estable entre hosts; solo orden relativo del feed).
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
      0,
    ),
  ).toISOString();
}

/**
 * `occurredAt` del feed para avisos por vencimiento.
 * Nunca usa una fecha futura: si no, los “próximos” se clavan arriba del listado.
 */
export function feedOccurredAtForDueYmd(
  dueYmd: string,
  todayYmd: string,
): string {
  const due = dueYmd.trim();
  const today = todayYmd.trim();
  if (!due) {
    return dueYmdToIso(today || operationalFallbackTodayYmd());
  }
  if (today && due > today) {
    return dueYmdToIso(today);
  }
  return dueYmdToIso(due);
}

function operationalFallbackTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
