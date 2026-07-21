import type { ExpenseVerificationScope } from 'src/expenses/expense-payload.util';
import { VERIFICATION_SCOPE_SPECS } from 'src/fleet/fleet-verification-expense-sync.util';

export type VerificationEntryLike = {
  scope?: string | null;
  date?: string | null;
  entryDate?: string | null;
  cost?: number | string | null;
  notes?: string | null;
  paymentMethod?: string | null;
  status?: string | null;
};

export type VerificationMetaScalars = {
  verificationPhysMechDate?: string;
  verificationPhysMechCost?: number;
  verificationEmissionsDate?: string;
  verificationEmissionsCost?: number;
  verificationDoubleArticulatedDate?: string;
  verificationDoubleArticulatedCost?: number;
  verificationDoubleArticulatedApplies?: boolean;
};

function emptyDate(value?: string | null): string {
  return value?.trim() ?? '';
}

function dbNumToApi(value?: string | number | null): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function isSubstantiveVerificationEntry(entry: VerificationEntryLike): boolean {
  if (emptyDate(entry.date ?? entry.entryDate)) {
    return true;
  }
  if ((entry.notes ?? '').trim()) {
    return true;
  }
  const cost = dbNumToApi(entry.cost);
  return cost != null && cost > 0;
}

/** Latest entry per scope (by entry_date desc, then sort_order). */
export function latestVerificationByScope(
  entries: readonly VerificationEntryLike[],
): Map<ExpenseVerificationScope, VerificationEntryLike> {
  const map = new Map<ExpenseVerificationScope, VerificationEntryLike>();
  const dated = entries
    .map((entry, index) => ({
      entry,
      date: emptyDate(entry.date ?? entry.entryDate),
      index,
    }))
    .filter(({ date }) => date.length > 0)
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) {
        return byDate;
      }
      return b.index - a.index;
    });

  for (const { entry } of dated) {
    const scope = entry.scope as ExpenseVerificationScope | undefined;
    if (!scope || map.has(scope)) {
      continue;
    }
    if (!VERIFICATION_SCOPE_SPECS.some((s) => s.scope === scope)) {
      continue;
    }
    map.set(scope, entry);
  }
  return map;
}

/** Derive API-compatible verification*Date/Cost scalars from history. */
export function verificationEntriesToMetaScalars(
  entries: readonly VerificationEntryLike[] | undefined,
): VerificationMetaScalars {
  const latest = latestVerificationByScope(entries ?? []);
  const out: VerificationMetaScalars = {};

  const phys = latest.get('phys_mech');
  if (phys) {
    out.verificationPhysMechDate = emptyDate(phys.date ?? phys.entryDate) || undefined;
    out.verificationPhysMechCost = dbNumToApi(phys.cost);
  }

  const emis = latest.get('emissions');
  if (emis) {
    out.verificationEmissionsDate = emptyDate(emis.date ?? emis.entryDate) || undefined;
    out.verificationEmissionsCost = dbNumToApi(emis.cost);
  }

  const dbl = latest.get('double_articulated');
  if (dbl) {
    out.verificationDoubleArticulatedDate =
      emptyDate(dbl.date ?? dbl.entryDate) || undefined;
    out.verificationDoubleArticulatedCost = dbNumToApi(dbl.cost);
  }

  return out;
}

/**
 * Build entries to persist from either explicit `verificationEntries` or
 * scalar last-event fields in the DTO (append-friendly for FE).
 */
export function resolveVerificationEntriesFromMeta(meta: {
  verificationEntries?: Array<{
    scope?: string;
    date?: string;
    cost?: number;
    notes?: string;
    paymentMethod?: string;
    status?: string;
  }>;
  verificationPhysMechDate?: string;
  verificationPhysMechCost?: number;
  verificationEmissionsDate?: string;
  verificationEmissionsCost?: number;
  verificationDoubleArticulatedDate?: string;
  verificationDoubleArticulatedCost?: number;
}): VerificationEntryLike[] {
  if (meta.verificationEntries !== undefined) {
    return meta.verificationEntries
      .map((e) => ({
        scope: e.scope,
        date: e.date,
        cost: e.cost,
        notes: e.notes,
        paymentMethod: e.paymentMethod,
      }))
      .filter(isSubstantiveVerificationEntry);
  }

  const rows: VerificationEntryLike[] = [];
  const push = (
    scope: ExpenseVerificationScope,
    date?: string,
    cost?: number,
  ) => {
    const normalized = emptyDate(date);
    if (!normalized) {
      return;
    }
    rows.push({
      scope,
      date: normalized,
      cost,
    });
  };

  push('phys_mech', meta.verificationPhysMechDate, meta.verificationPhysMechCost);
  push('emissions', meta.verificationEmissionsDate, meta.verificationEmissionsCost);
  push(
    'double_articulated',
    meta.verificationDoubleArticulatedDate,
    meta.verificationDoubleArticulatedCost,
  );
  return rows;
}

/**
 * When FE only patches scalars (not full history), merge previous history with
 * new events for scopes whose date changed.
 */
export function mergeVerificationHistoryOnScalarSave(params: {
  previous: readonly VerificationEntryLike[];
  incomingScalars: VerificationMetaScalars & {
    verificationPhysMechDate?: string;
    verificationEmissionsDate?: string;
    verificationDoubleArticulatedDate?: string;
    verificationPhysMechCost?: number;
    verificationEmissionsCost?: number;
    verificationDoubleArticulatedCost?: number;
  };
  scopes?: readonly ExpenseVerificationScope[];
}): VerificationEntryLike[] {
  const allowed = new Set(
    params.scopes ?? (['phys_mech', 'emissions', 'double_articulated'] as const),
  );
  const previous = params.previous.filter(isSubstantiveVerificationEntry);
  const latest = latestVerificationByScope(previous);
  const next = [...previous];

  for (const spec of VERIFICATION_SCOPE_SPECS) {
    if (!allowed.has(spec.scope)) {
      continue;
    }
    const dateKey = spec.dateKey as keyof typeof params.incomingScalars;
    const costKey = spec.costKey as keyof typeof params.incomingScalars;
    if (!(dateKey in params.incomingScalars)) {
      continue;
    }
    const date = emptyDate(params.incomingScalars[dateKey] as string | undefined);
    if (!date) {
      continue;
    }
    const prevDate = emptyDate(
      (latest.get(spec.scope)?.date ?? latest.get(spec.scope)?.entryDate) as
        | string
        | undefined,
    );
    if (prevDate === date) {
      continue;
    }
    next.push({
      scope: spec.scope,
      date,
      cost: params.incomingScalars[costKey] as number | undefined,
    });
  }

  return next;
}
