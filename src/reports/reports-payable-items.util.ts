import type { Expense } from 'src/expenses/entities/expense.entity';
import { LEDGER_SCHEDULED_KINDS } from 'src/expenses/ledger-scheduled-kinds';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';

export type PayableItemStatus = 'pending' | 'overdue';

export interface PayableItemDto {
  description: string;
  amount: number;
  beneficiary: string | null;
  installmentLabel: string;
  dueDate: string;
  status: PayableItemStatus;
}

export const LEDGER_PAYABLE_KINDS = LEDGER_SCHEDULED_KINDS;

function parseMoney(raw?: string | number | null): number {
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function operationalTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parseInstallmentFromHint(hint: string): string {
  const m = /\((?:.*?)(\d+)\/(\d+)\)/.exec(hint);
  return m ? `${m[1]}/${m[2]}` : '1/1';
}

function payableDescription(exp: Expense): string {
  const desc = exp.description?.trim();
  if (desc) {
    return desc;
  }
  const category = exp.category?.trim();
  if (category) {
    return category;
  }
  switch (exp.kind) {
    case 'insurance':
      return 'Seguro';
    case 'gps':
      return 'GPS';
    case 'verification':
      return 'Verificación';
    case 'tenure_payment':
      return 'Cuota financiamiento';
    case 'operator_payment':
    case 'operator_commission':
      return 'Pago a operador';
    default:
      return exp.kind ?? 'Pago';
  }
}

/**
 * Abierto si vence en o antes de `to`. El resto del mes son fechas
 * desde hoy; lo vencido (aunque sea de meses atrás) sigue saliendo
 * hasta que se confirme el pago.
 */
export function isOpenLedgerPayable(dueYmd: string, to: string): boolean {
  return Boolean(dueYmd) && dueYmd <= to;
}

export function buildPayableItems(params: {
  expenses: readonly Expense[];
  to: string;
  today?: string;
}): PayableItemDto[] {
  const today = params.today ?? operationalTodayYmd();
  const items: PayableItemDto[] = [];
  const kinds = new Set<string>(LEDGER_PAYABLE_KINDS);

  for (const exp of params.expenses) {
    if (!kinds.has(exp.kind ?? '')) {
      continue;
    }
    if (exp.discardedAt) {
      continue;
    }
    if (exp.paidAt != null) {
      continue;
    }
    if (!exp.incurredAt) {
      continue;
    }
    const dueDate = formatOperationalIncurredDateYmd(exp.incurredAt);
    if (!isOpenLedgerPayable(dueDate, params.to)) {
      continue;
    }

    items.push({
      description: payableDescription(exp),
      amount: parseMoney(exp.amount),
      beneficiary: exp.vendor?.trim() || null,
      installmentLabel: parseInstallmentFromHint(exp.description ?? ''),
      dueDate,
      status: dueDate < today ? 'overdue' : 'pending',
    });
  }

  items.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.description.localeCompare(b.description, 'es'),
  );
  return items;
}
