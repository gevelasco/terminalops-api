import { EXPENSE_RUBRO_LABELS } from 'src/reports/reports-expense-rubro.util';

const MANIOBRA_TRIP_KINDS = [
  'trip',
  'fuel',
  'tolls',
  'per_diem',
  'lodging',
] as const;

const RUBRO_SEARCH_SQL: Record<string, string> = {
  maniobra: `(
    e.kind IN ('operator_payment', 'operator_commission')
    OR (
      e.trip_id IS NOT NULL
      AND e.kind IN (${sqlInList(MANIOBRA_TRIP_KINDS)})
    )
  )`,
  mantenimiento: `e.kind IN ('maintenance', 'tires')`,
  reparacion: `e.kind = 'repair'`,
  seguros: `e.kind = 'insurance'`,
  gps: `e.kind = 'gps'`,
  administracion: `e.kind IN (
    'unit_purchase',
    'equipment_purchase',
    'unit_rent',
    'equipment_rent',
    'trailer_admin_payout',
    'operational_control'
  )`,
  verificaciones: `e.kind = 'verification'`,
  otro: `e.kind = 'other'`,
};

/** Quita prefijos como «Rubro:» que el usuario copia de la tabla. */
export function normalizeExpenseListSearchQuery(q: string): string {
  return q.trim().replace(/^rubro\s*:\s*/i, '').trim();
}

/** Rubros cuya etiqueta coincide parcialmente con la consulta. */
export function rubroKeysMatchingExpenseSearch(q: string): string[] {
  const needle = normalizeExpenseListSearchQuery(q).toLowerCase();
  if (!needle) {
    return [];
  }

  return Object.entries(EXPENSE_RUBRO_LABELS).filter(([key, label]) => {
    const lbl = label.toLowerCase();
    const keySpaced = key.replace(/_/g, ' ').toLowerCase();
    return (
      lbl.includes(needle) ||
      needle.includes(lbl) ||
      keySpaced.includes(needle) ||
      needle.includes(keySpaced)
    );
  }).map(([key]) => key);
}

/** SQL OR para filas que pertenecen a los rubros indicados. */
export function expenseRubroSearchSql(rubroKeys: readonly string[]): string | null {
  const parts = rubroKeys
    .map((key) => RUBRO_SEARCH_SQL[key])
    .filter((sql): sql is string => Boolean(sql));
  if (parts.length === 0) {
    return null;
  }
  return parts.map((part) => `(${part})`).join(' OR ');
}

function sqlInList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}
