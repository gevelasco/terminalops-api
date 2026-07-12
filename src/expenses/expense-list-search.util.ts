import {
  EXPENSE_PAYMENT_METHOD_LABELS,
  EXPENSE_PAYMENT_METHODS,
} from './expense-payment-method.util';
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
  servicio: `e.kind = 'service'`,
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
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
}

/** Códigos de método de pago cuya etiqueta o código coincide con la consulta. */
export function paymentMethodsMatchingExpenseSearch(q: string): string[] {
  const needle = normalizeExpenseListSearchQuery(q).toLowerCase();
  if (!needle) {
    return [];
  }

  const matched = new Set<string>();
  for (const code of EXPENSE_PAYMENT_METHODS) {
    const label = EXPENSE_PAYMENT_METHOD_LABELS[code].toLowerCase();
    const codeSpaced = code.replace(/_/g, ' ').toLowerCase();
    if (
      label.includes(needle) ||
      needle.includes(label) ||
      code.includes(needle) ||
      needle.includes(code) ||
      codeSpaced.includes(needle) ||
      needle.includes(codeSpaced)
    ) {
      matched.add(code);
    }
  }

  if (needle.includes('tarjeta') || needle.includes('card')) {
    matched.add('card');
  }

  return [...matched];
}

/** Fecha operativa `YYYY-MM-DD` si la consulta parece una fecha completa. */
export function parseExpenseListSearchDateYmd(q: string): string | null {
  const needle = normalizeExpenseListSearchQuery(q).trim();
  if (!needle) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(needle)) {
    return needle;
  }

  const dmy4 = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(needle);
  if (dmy4) {
    return `${dmy4[3]}-${dmy4[2].padStart(2, '0')}-${dmy4[1].padStart(2, '0')}`;
  }

  const dmy2 = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/.exec(needle);
  if (dmy2) {
    const year = Number(dmy2[3]) >= 70 ? `19${dmy2[3]}` : `20${dmy2[3]}`;
    return `${year}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`;
  }

  return null;
}
