import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';

function normalizeCycleDueDate(raw: string): string {
  const trimmed = raw.trim();
  const ymd = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)?.[1];
  return ymd ?? trimmed;
}

/** Fecha del gasto: día del pago si el ciclo ya venció; si no, la fecha del ciclo. */
export function resolveFleetCyclePaymentIncurredDate(
  cycleDueDate: string,
  now = new Date(),
): string {
  const due = normalizeCycleDueDate(cycleDueDate);
  if (!due) {
    return formatOperationalIncurredDateYmd(now);
  }
  const today = formatOperationalIncurredDateYmd(now);
  return due < today ? today : due;
}
