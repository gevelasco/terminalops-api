import { Expense } from 'src/expenses/entities/expense.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';

export function serializeExpense(expense: Expense): Record<string, unknown> {
  return {
    id: expense.id,
    companyId: expense.companyId,
    tripId: expense.trip?.id ?? expense.tripId ?? null,
    category: expense.category,
    amount: expense.amount,
    currency: expense.currency,
    incurredAt: toIsoString(expense.incurredAt),
    kind: expense.kind,
    description: expense.description ?? undefined,
    relatedUnitId: expense.relatedUnit?.id ?? expense.relatedUnitId ?? null,
    relatedEquipmentId:
      expense.relatedEquipment?.id ?? expense.relatedEquipmentId ?? null,
    relatedOperatorId:
      expense.relatedOperator?.id ?? expense.relatedOperatorId ?? null,
    isOperationalProvision: expense.isOperationalProvision,
    invoiceRequired: expense.invoiceRequired,
    createdAt: toIsoString(expense.createdAt),
    updatedAt: toIsoString(expense.updatedAt),
  };
}
