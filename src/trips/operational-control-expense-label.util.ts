export const DEFAULT_OPERATIONAL_CONTROL_EXPENSE_LABEL = 'Control operativo';

export const OPERATIONAL_CONTROL_EXPENSE_LABEL_MAX = 80;

export function resolveOperationalControlExpenseLabel(
  raw?: string | null,
): string {
  const trimmed = (raw ?? '').trim();
  return trimmed || DEFAULT_OPERATIONAL_CONTROL_EXPENSE_LABEL;
}

export function normalizeOperationalControlExpenseLabelInput(
  raw?: string | null,
): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > OPERATIONAL_CONTROL_EXPENSE_LABEL_MAX) {
    return trimmed.slice(0, OPERATIONAL_CONTROL_EXPENSE_LABEL_MAX);
  }
  return trimmed;
}