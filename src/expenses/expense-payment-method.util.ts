/** Catálogo alineado con gastos del frontend (`EXPENSE_PAYMENT_METHOD_OPTIONS`). */
export const EXPENSE_PAYMENT_METHODS = [
  'transfer',
  'debit_card',
  'credit_card',
  'cash',
  'check',
  'credit',
  'other',
] as const;

export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

/** Etiquetas UI en español (mismo texto que la tabla de gastos). */
export const EXPENSE_PAYMENT_METHOD_LABELS: Record<
  ExpensePaymentMethod,
  string
> = {
  transfer: 'Transferencia',
  debit_card: 'Tarjeta de débito',
  credit_card: 'Tarjeta de crédito',
  cash: 'Efectivo',
  check: 'Cheque',
  credit: 'Crédito / proveedor',
  other: 'Otro',
};

export function normalizeExpensePaymentMethod(
  raw?: string | null,
  fallback: ExpensePaymentMethod = 'cash',
): ExpensePaymentMethod {
  const normalized = raw?.trim().toLowerCase() ?? '';
  if (EXPENSE_PAYMENT_METHODS.includes(normalized as ExpensePaymentMethod)) {
    return normalized as ExpensePaymentMethod;
  }
  return fallback;
}
