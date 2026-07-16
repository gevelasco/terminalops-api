const MANIOBRA_KINDS = new Set([
  'trip',
  'fuel',
  'tolls',
  'per_diem',
  'lodging',
  'operator_payment',
  'operator_commission',
]);

const KIND_DEFAULT_RUBRO = new Map<string, string>([
  ['trip', 'maniobra'],
  ['fuel', 'maniobra'],
  ['tolls', 'maniobra'],
  ['per_diem', 'maniobra'],
  ['lodging', 'maniobra'],
  ['operator_payment', 'maniobra'],
  ['operator_commission', 'maniobra'],
  ['maintenance', 'mantenimiento'],
  ['repair', 'reparacion'],
  ['tires', 'mantenimiento'],
  ['verification', 'verificaciones'],
  ['insurance', 'seguros'],
  ['gps', 'gps'],
  ['unit_purchase', 'administracion'],
  ['equipment_purchase', 'administracion'],
  ['unit_rent', 'administracion'],
  ['equipment_rent', 'administracion'],
  ['tenure_payment', 'financiamiento'],
  ['trailer_admin_payout', 'administracion'],
  ['operational_control', 'administracion'],
  ['service', 'servicio'],
  ['other', 'otro'],
]);

const RUBRO_LABELS: Record<string, string> = {
  maniobra: 'Maniobra',
  mantenimiento: 'Mantenimiento',
  reparacion: 'Reparación',
  seguros: 'Seguros',
  gps: 'GPS',
  administracion: 'Administración',
  financiamiento: 'Financiamiento',
  verificaciones: 'Verificaciones',
  servicio: 'Servicio',
  gasto: 'Gasto',
  otro: 'Otro',
};

export const EXPENSE_RUBRO_LABELS = RUBRO_LABELS;

export function expenseRubroFromKind(kind: string, tripId: number | null | undefined): string {
  const normalized = kind?.trim().toLowerCase() ?? '';
  if (tripId != null && MANIOBRA_KINDS.has(normalized)) {
    return 'maniobra';
  }
  if (normalized === 'operator_payment' || normalized === 'operator_commission') {
    return 'maniobra';
  }
  return KIND_DEFAULT_RUBRO.get(normalized) ?? 'gasto';
}

export function expenseRubroLabel(rubro: string): string {
  return RUBRO_LABELS[rubro] ?? rubro;
}

export type ExpenseRubroAggregate = {
  rubro: string;
  label: string;
  amount: number;
  count: number;
};

function parseMoneySum(raw: string | null | undefined): number {
  if (raw == null || !String(raw).trim()) {
    return 0;
  }
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function buildExpensesByRubroFromKindRows(
  rows: Array<{ kind: string; has_trip: string | number; sum: string; count: string }>,
): ExpenseRubroAggregate[] {
  const rubroMap = new Map<string, { amount: number; count: number }>();
  for (const row of rows) {
    const rubro = expenseRubroFromKind(
      String(row.kind ?? ''),
      Number(row.has_trip) > 0 ? 1 : null,
    );
    const bucket = rubroMap.get(rubro) ?? { amount: 0, count: 0 };
    bucket.amount += parseMoneySum(row.sum);
    bucket.count += Number(row.count) || 0;
    rubroMap.set(rubro, bucket);
  }

  return [...rubroMap.entries()]
    .map(([rubro, stats]) => ({
      rubro,
      label: expenseRubroLabel(rubro),
      amount: Math.round(stats.amount * 100) / 100,
      count: stats.count,
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}
