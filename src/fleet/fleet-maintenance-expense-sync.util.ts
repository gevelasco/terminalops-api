export type MaintenanceEntryLike = {
  date?: string | Date | null;
  entryDate?: string | Date | null;
  type?: string;
  entryType?: string;
  cost?: number | string | null;
  notes?: string | null;
  paymentMethod?: string | null;
  status?: string | null;
};

export type MaintenanceExpenseLike = {
  category?: string | null;
  amount?: string | number | null;
  incurredAt?: Date | string | null;
  description?: string | null;
};

/** pg `date` / entity values may arrive as Date; normalize to YYYY-MM-DD. */
export function maintenanceEntryDateYmd(
  value: string | Date | null | undefined,
): string {
  if (value == null || value === '') {
    return '';
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '';
    }
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  if (!raw) {
    return '';
  }
  // Accept ISO timestamps by taking the date part.
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : raw;
}

function entryYmd(entry: MaintenanceEntryLike): string {
  return maintenanceEntryDateYmd(entry.date ?? entry.entryDate);
}

export function maintenanceExpenseExpectedDescription(
  entryType: string,
  notes?: string | null,
): string {
  const type = entryType.trim();
  const noteText = notes?.trim();
  return noteText || (type ? `Mantenimiento: ${type}` : 'Mantenimiento');
}

export function maintenanceEntryFingerprint(entry: MaintenanceEntryLike): string {
  const date = entryYmd(entry);
  const type = (entry.type ?? entry.entryType ?? '').trim();
  const rawCost = entry.cost;
  const cost =
    rawCost == null || rawCost === ''
      ? ''
      : String(Number(rawCost));
  return `${date}|${type}|${cost}`;
}

export function isBillableMaintenanceEntry(entry: MaintenanceEntryLike): boolean {
  const rawCost = entry.cost;
  if (rawCost == null || rawCost === '') {
    return false;
  }
  const amount = Number(rawCost);
  return Number.isFinite(amount) && amount > 0;
}

/** Historial real: requiere fecha, costo, notas o documentos; el tipo solo no basta. */
export function isSubstantiveMaintenanceEntry(entry: MaintenanceEntryLike): boolean {
  if (entryYmd(entry)) {
    return true;
  }
  const notes = (entry.notes ?? '').trim();
  if (notes) {
    return true;
  }
  if (isBillableMaintenanceEntry(entry)) {
    return true;
  }
  return false;
}

/** @deprecated Use isBillableMaintenanceEntry */
export const isBillableConcludedMaintenance = isBillableMaintenanceEntry;

export function findNewBillableMaintenanceEntries(
  previous: MaintenanceEntryLike[],
  incoming: MaintenanceEntryLike[],
): MaintenanceEntryLike[] {
  const previousKeys = new Set(previous.map(maintenanceEntryFingerprint));
  return incoming.filter(
    (entry) =>
      isBillableMaintenanceEntry(entry) &&
      !previousKeys.has(maintenanceEntryFingerprint(entry)),
  );
}

export function maintenanceEntryMatchesExpense(
  entry: MaintenanceEntryLike,
  expense: MaintenanceExpenseLike,
  incurredYmd: string,
): boolean {
  const entryDate = entryYmd(entry);
  if (!entryDate || entryDate !== incurredYmd) {
    return false;
  }

  const entryType = (entry.type ?? entry.entryType ?? '').trim();
  const category = (expense.category ?? '').trim();
  if (!entryType || entryType !== category) {
    return false;
  }

  const entryCost = Number(entry.cost);
  const expenseAmount = Number(expense.amount);
  if (
    !Number.isFinite(entryCost) ||
    !Number.isFinite(expenseAmount) ||
    Math.abs(entryCost - expenseAmount) > 0.001
  ) {
    return false;
  }

  const expectedDescription = maintenanceExpenseExpectedDescription(
    entryType,
    entry.notes,
  );
  const description = (expense.description ?? '').trim();
  return description === expectedDescription;
}

export function recomputeLastMaintenanceFields(
  entries: readonly MaintenanceEntryLike[],
): {
  lastMaintenanceDate: string | null;
  lastMaintenanceType: string | null;
  lastMaintenanceCost: string | null;
  lastMaintenanceNotes: string | null;
} {
  const dated = entries
    .map((entry) => ({
      entry,
      date: entryYmd(entry),
    }))
    .filter(({ date }) => date.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  const latest = dated[0]?.entry;
  if (!latest) {
    return {
      lastMaintenanceDate: null,
      lastMaintenanceType: null,
      lastMaintenanceCost: null,
      lastMaintenanceNotes: null,
    };
  }

  const date = entryYmd(latest);
  const type = (latest.type ?? latest.entryType ?? '').trim();
  const rawCost = latest.cost;
  const cost =
    rawCost == null || rawCost === ''
      ? null
      : String(Number(rawCost));
  const notes = latest.notes?.trim() || null;

  return {
    lastMaintenanceDate: date || null,
    lastMaintenanceType: type || null,
    lastMaintenanceCost: cost,
    lastMaintenanceNotes: notes,
  };
}
