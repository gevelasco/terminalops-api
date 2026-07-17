import { COMPANY_ACTIVITY_KIND } from './company-activity-event.kinds';
import type { Expense } from 'src/expenses/entities/expense.entity';

const COVERAGE_KINDS = new Set(['insurance', 'gps', 'verification']);

export function expenseActivityOnCreate(expense: Expense): {
  kind: string;
  title: string;
} | null {
  if (expense.discardedAt != null) {
    return null;
  }
  if (COVERAGE_KINDS.has(expense.kind)) {
    return {
      kind: COMPANY_ACTIVITY_KIND.COVERAGE_PAYMENT_CONFIRMED,
      title: coverageTitle(expense.kind),
    };
  }
  if (isManualExpense(expense)) {
    return {
      kind: COMPANY_ACTIVITY_KIND.EXPENSE_MANUAL_CREATED,
      title: 'Gasto registrado',
    };
  }
  return null;
}

export function expenseActivityOnUpdate(
  expense: Expense,
  previous?: Expense,
): {
  kind: string;
  title: string;
} | null {
  if (expense.discardedAt != null) {
    return null;
  }
  if (previous?.paidAt == null && expense.paidAt != null) {
    return {
      kind: COMPANY_ACTIVITY_KIND.PAYMENT_CONFIRMED,
      title: paymentTransitionTitle(expense.kind, true),
    };
  }
  if (previous?.paidAt != null && expense.paidAt == null) {
    return {
      kind: COMPANY_ACTIVITY_KIND.PAYMENT_REVERTED,
      title: paymentTransitionTitle(expense.kind, false),
    };
  }
  return {
    kind: COMPANY_ACTIVITY_KIND.EXPENSE_UPDATED,
    title: 'Gasto modificado',
  };
}

function paymentTransitionTitle(kind: string, confirmed: boolean): string {
  const action = confirmed ? 'confirmado' : 'removido';
  switch (kind) {
    case 'insurance':
      return confirmed
        ? 'Pago de seguro confirmado'
        : 'Confirmación de seguro removida';
    case 'gps':
      return confirmed
        ? 'Pago de GPS confirmado'
        : 'Confirmación de GPS removida';
    case 'tenure_payment':
      return confirmed
        ? 'Cuota de financiamiento confirmada'
        : 'Confirmación de cuota removida';
    case 'verification':
      return confirmed
        ? 'Pago de verificación confirmado'
        : 'Confirmación de verificación removida';
    default:
      return `Pago ${action}`;
  }
}

function isManualExpense(expense: Expense): boolean {
  if (expense.tripId != null) {
    return false;
  }
  if (expense.isOperationalProvision === true) {
    return false;
  }
  if (COVERAGE_KINDS.has(expense.kind)) {
    return false;
  }
  return true;
}

function coverageTitle(kind: string): string {
  switch (kind) {
    case 'insurance':
      return 'Pago de seguro confirmado';
    case 'gps':
      return 'Pago de GPS confirmado';
    case 'verification':
      return 'Pago de verificación confirmado';
    default:
      return 'Pago de cobertura confirmado';
  }
}

export function expenseActivitySubjectLabel(expense: Expense): string {
  const description = expense.description?.trim();
  if (description) {
    return description;
  }
  return `Gasto #${expense.id}`;
}
