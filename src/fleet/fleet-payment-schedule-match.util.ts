import type { Expense } from 'src/expenses/entities/expense.entity';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import { parseCoverageInstallmentIndex } from './fleet-coverage-payment-period.util';

export function expenseIncurredDateYmd(expense: Expense): string {
  return formatOperationalIncurredDateYmd(expense.incurredAt);
}

export function fleetPaymentExpenseForCycle(
  dueDate: string,
  lastPaymentDate: string | undefined,
  paymentExpenses: readonly Expense[],
  cycleIndex?: number,
): Expense | undefined {
  if (cycleIndex != null) {
    const byInstallment = paymentExpenses.find(
      (expense) => parseCoverageInstallmentIndex(expense.description) === cycleIndex,
    );
    if (byInstallment) {
      return byInstallment;
    }
  }

  const normalizedDue = dueDate.trim();
  const direct = paymentExpenses.find(
    (expense) => expenseIncurredDateYmd(expense) === normalizedDue,
  );
  if (direct) {
    return direct;
  }

  const lastPaid = lastPaymentDate?.trim();
  if (!lastPaid || lastPaid < normalizedDue || cycleIndex != null) {
    return undefined;
  }

  let matched: Expense | undefined;
  for (const expense of paymentExpenses) {
    const paidYmd = expenseIncurredDateYmd(expense);
    if (paidYmd < normalizedDue) {
      continue;
    }
    if (!matched) {
      matched = expense;
      continue;
    }
    const currentYmd = expenseIncurredDateYmd(matched);
    if (paidYmd.localeCompare(currentYmd) < 0) {
      matched = expense;
    }
  }
  return matched;
}

export function fleetCycleIsPaid(matchedExpense: Expense | undefined): boolean {
  if (!matchedExpense) return false;
  return matchedExpense.paidAt != null;
}
