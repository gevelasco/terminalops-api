import type { ExpenseVerificationScope } from 'src/expenses/expense-payload.util';

export type VerificationExpenseCandidate = {
  scope: ExpenseVerificationScope;
  date: string;
  cost: number;
  category: string;
};

type VerificationProfileLike = {
  verificationPhysMechDate?: string | null;
  verificationPhysMechCost?: string | number | null;
  verificationEmissionsDate?: string | null;
  verificationEmissionsCost?: string | number | null;
  verificationDoubleArticulatedApplies?: boolean | null;
  verificationDoubleArticulatedDate?: string | null;
  verificationDoubleArticulatedCost?: string | number | null;
};

type VerificationMetaLike = VerificationProfileLike & {
  verificationPhysMechDate?: string;
  verificationPhysMechCost?: number;
  verificationEmissionsDate?: string;
  verificationEmissionsCost?: number;
  verificationDoubleArticulatedDate?: string;
  verificationDoubleArticulatedCost?: number;
};

export const VERIFICATION_SCOPE_SPECS: Array<{
  scope: ExpenseVerificationScope;
  category: string;
  dateKey: keyof VerificationMetaLike;
  costKey: keyof VerificationMetaLike;
  applies?: (meta: VerificationMetaLike) => boolean;
}> = [
  {
    scope: 'phys_mech',
    category: 'Verificación - físico-mecánica',
    dateKey: 'verificationPhysMechDate',
    costKey: 'verificationPhysMechCost',
  },
  {
    scope: 'emissions',
    category: 'Verificación - emisiones',
    dateKey: 'verificationEmissionsDate',
    costKey: 'verificationEmissionsCost',
  },
  {
    scope: 'double_articulated',
    category: 'Verificación - doble articulado',
    dateKey: 'verificationDoubleArticulatedDate',
    costKey: 'verificationDoubleArticulatedCost',
    applies: (meta) => meta.verificationDoubleArticulatedApplies !== false,
  },
];

function parsePositiveCost(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') {
    return null;
  }
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function normalizeDate(raw: string | null | undefined): string {
  return raw?.trim() ?? '';
}

export function findNewBillableVerificationEvents(
  previous: VerificationProfileLike | null | undefined,
  incoming: VerificationMetaLike,
  scopes: readonly ExpenseVerificationScope[] = [
    'phys_mech',
    'emissions',
    'double_articulated',
  ],
): VerificationExpenseCandidate[] {
  const allowed = new Set(scopes);
  const results: VerificationExpenseCandidate[] = [];

  for (const spec of VERIFICATION_SCOPE_SPECS) {
    if (!allowed.has(spec.scope)) {
      continue;
    }
    if (spec.applies && !spec.applies(incoming)) {
      continue;
    }
    if (!(spec.dateKey in incoming)) {
      continue;
    }

    const date = normalizeDate(incoming[spec.dateKey] as string | undefined);
    if (!date) {
      continue;
    }

    const cost = parsePositiveCost(incoming[spec.costKey] as string | number | undefined);
    if (cost == null) {
      continue;
    }

    const previousDate = normalizeDate(
      previous?.[spec.dateKey] as string | null | undefined,
    );
    if (previousDate === date) {
      continue;
    }

    results.push({
      scope: spec.scope,
      date,
      cost,
      category: spec.category,
    });
  }

  return results;
}
