import type { ExpenseVerificationScope } from 'src/expenses/expense-payload.util';
import {
  isExpenseVerificationScope,
  verificationScopeFromExpenseText,
} from 'src/expenses/expense-payload.util';
import { VERIFICATION_SCOPE_SPECS } from 'src/fleet/fleet-verification-expense-sync.util';

export type VerificationProfileFieldKeys = {
  dateKey:
    | 'verificationPhysMechDate'
    | 'verificationEmissionsDate'
    | 'verificationDoubleArticulatedDate';
  costKey:
    | 'verificationPhysMechCost'
    | 'verificationEmissionsCost'
    | 'verificationDoubleArticulatedCost';
};

export function verificationScopeFieldKeys(
  scope: string,
): VerificationProfileFieldKeys | null {
  const spec = VERIFICATION_SCOPE_SPECS.find((row) => row.scope === scope);
  if (!spec) {
    return null;
  }
  return {
    dateKey: spec.dateKey as VerificationProfileFieldKeys['dateKey'],
    costKey: spec.costKey as VerificationProfileFieldKeys['costKey'],
  };
}

export type VerificationDateProfileLike = {
  verificationPhysMechDate?: string | null;
  verificationEmissionsDate?: string | null;
  verificationDoubleArticulatedDate?: string | null;
};

export function verificationProfileDate(
  profile: VerificationDateProfileLike | null | undefined,
  keys: VerificationProfileFieldKeys,
): string {
  const raw = profile?.[keys.dateKey];
  return typeof raw === 'string' ? raw.trim() : '';
}

export { isExpenseVerificationScope, verificationScopeFromExpenseText };
export type { ExpenseVerificationScope };
