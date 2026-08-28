import { LEDGER_SCHEDULED_KIND_SET } from './ledger-scheduled-kinds';
import {
  expenseRubroFromKind,
  expenseRubroLabel,
} from 'src/reports/reports-expense-rubro.util';

export type ExpenseCalendarEntryType = 'actual';

export interface ExpenseCalendarEntry {
  entryType: ExpenseCalendarEntryType;
  sortDate: string;
  id: string;
  rubroLabel: string;
  conceptLabel: string;
  amount: string;
  currency: string;
  dateYmd: string;
  statusLabel: string;
  expenseId?: number;
  kind?: string;
}

export interface ExpenseCalendarMarker {
  label: string;
  amount: string;
  pct: number;
  tone: 'primary' | 'muted' | 'accent';
}

export interface ExpenseCalendarLedgerResult {
  entries: ExpenseCalendarEntry[];
  markers: ExpenseCalendarMarker[];
  summary: {
    actualCount: number;
    actualTotalAmount: number;
    grandCount: number;
    grandTotalAmount: number;
  };
}

function parseMoney(raw?: string | null): number {
  if (raw == null || raw === '') {
    return 0;
  }
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}

const PROGRAMADO_EXPENSE_KINDS = LEDGER_SCHEDULED_KIND_SET;

const EVENTUAL_EXPENSE_RUBROS = new Set([
  'reparacion',
  'servicio',
  'gasto',
  'otro',
  'administracion',
]);

const EVENTUAL_EXPENSE_KINDS = new Set([
  'repair',
  'other',
  'unit_purchase',
  'equipment_purchase',
]);

type ExpenseCalendarMarkerBucket =
  | 'directos'
  | 'eventuales'
  | 'recurrentes'
  | 'porPagar';

function resolveActualStatusLabel(item: Record<string, unknown>): string {
  const kind = String(item['kind'] ?? '');
  if (!PROGRAMADO_EXPENSE_KINDS.has(kind)) {
    return 'Realizado';
  }
  const paidAt = item['paidAt'];
  if (paidAt != null && paidAt !== '' && paidAt !== false) {
    return 'Pagado';
  }
  const dateYmd =
    typeof item['incurredDate'] === 'string' && item['incurredDate']
      ? item['incurredDate']
      : typeof item['incurredAt'] === 'string'
        ? item['incurredAt'].slice(0, 10)
        : '';
  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (dateYmd < todayYmd) return 'Vencido';
  return 'Pendiente';
}

export function actualEntryFromSerialized(
  item: Record<string, unknown>,
): ExpenseCalendarEntry {
  const amountRaw = item['amount'];
  const amount =
    typeof amountRaw === 'number'
      ? formatMoney(amountRaw)
      : String(amountRaw ?? '0');
  const dateYmd =
    typeof item['incurredDate'] === 'string' && item['incurredDate']
      ? item['incurredDate']
      : typeof item['incurredAt'] === 'string'
        ? item['incurredAt'].slice(0, 10)
        : '';
  const kind = String(item['kind'] ?? '');
  const tripIdRaw = item['tripId'];
  const tripId =
    typeof tripIdRaw === 'number'
      ? tripIdRaw
      : tripIdRaw != null
        ? Number(tripIdRaw)
        : null;
  const rubro = expenseRubroFromKind(kind, Number.isFinite(tripId) ? tripId : null);

  return {
    entryType: 'actual',
    sortDate: dateYmd,
    id: `actual:${String(item['id'] ?? '')}`,
    rubroLabel: expenseRubroLabel(rubro),
    conceptLabel: String(item['category'] ?? ''),
    amount,
    currency: String(item['currency'] ?? 'MXN'),
    dateYmd,
    statusLabel: resolveActualStatusLabel(item),
    kind,
    expenseId:
      typeof item['id'] === 'number'
        ? item['id']
        : Number.isFinite(Number(item['id']))
          ? Number(item['id'])
          : undefined,
  };
}

function markerBucketForActual(
  item: Record<string, unknown>,
): ExpenseCalendarMarkerBucket {
  const kind = String(item['kind'] ?? '').trim().toLowerCase();
  if (PROGRAMADO_EXPENSE_KINDS.has(kind)) {
    const paidAt = item['paidAt'];
    if (paidAt == null || paidAt === '' || paidAt === false) {
      return 'porPagar';
    }
    return 'recurrentes';
  }
  const tripIdRaw = item['tripId'];
  const tripId =
    typeof tripIdRaw === 'number'
      ? tripIdRaw
      : tripIdRaw != null && String(tripIdRaw).trim() !== ''
        ? Number(tripIdRaw)
        : null;
  const rubro = expenseRubroFromKind(
    kind,
    tripId != null && Number.isFinite(tripId) ? tripId : null,
  );
  if (EVENTUAL_EXPENSE_RUBROS.has(rubro) || EVENTUAL_EXPENSE_KINDS.has(kind)) {
    return 'eventuales';
  }
  return 'directos';
}

function buildMarkers(
  actualItems: readonly Record<string, unknown>[],
): ExpenseCalendarMarker[] {
  const totals: Record<ExpenseCalendarMarkerBucket, number> = {
    directos: 0,
    eventuales: 0,
    recurrentes: 0,
    porPagar: 0,
  };

  for (const item of actualItems) {
    const amountRaw = item['amount'];
    const amount =
      typeof amountRaw === 'number'
        ? amountRaw
        : parseMoney(String(amountRaw ?? '0'));
    totals[markerBucketForActual(item)] += amount;
  }

  const total =
    totals.directos + totals.eventuales + totals.recurrentes + totals.porPagar;
  const pct = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

  const markers: ExpenseCalendarMarker[] = [
    {
      label: 'Directos',
      amount: formatMoney(totals.directos),
      pct: pct(totals.directos),
      tone: 'primary',
    },
    {
      label: 'Recurrentes',
      amount: formatMoney(totals.recurrentes),
      pct: pct(totals.recurrentes),
      tone: 'muted',
    },
    {
      label: 'Por pagar',
      amount: formatMoney(totals.porPagar),
      pct: pct(totals.porPagar),
      tone: 'accent',
    },
  ];

  if (totals.eventuales > 0) {
    markers.splice(1, 0, {
      label: 'Eventuales',
      amount: formatMoney(totals.eventuales),
      pct: pct(totals.eventuales),
      tone: 'accent',
    });
  }

  return markers;
}

/**
 * Calendario solo-ledger: si el gasto no está en expenses, no existe.
 * Joins de flota/operador sirven para etiquetas, no para inventar filas.
 */
export function buildLedgerCalendar(
  actualItems: readonly Record<string, unknown>[],
): ExpenseCalendarLedgerResult {
  const entries = actualItems.map(actualEntryFromSerialized);
  const actualTotal = entries.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  return {
    entries,
    markers: buildMarkers(actualItems),
    summary: {
      actualCount: entries.length,
      actualTotalAmount: actualTotal,
      grandCount: entries.length,
      grandTotalAmount: actualTotal,
    },
  };
}

export function paginateExpenseCalendarEntries<T>(
  entries: readonly T[],
  page: number,
  limit: number,
): { items: T[]; total: number; page: number; limit: number } {
  const total = entries.length;
  if (limit <= 0) {
    return { items: [...entries], total, page: 1, limit: total };
  }
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * limit;
  return {
    items: entries.slice(start, start + limit),
    total,
    page: safePage,
    limit,
  };
}
