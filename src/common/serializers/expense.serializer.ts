import { Expense } from 'src/expenses/entities/expense.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';

export function serializeExpense(
  expense: Expense,
  companyPublicId: number,
): Record<string, unknown> {
  return {
    id: expense.publicId,
    companyId: companyPublicId,
    tripId: expense.trip?.publicId ?? null,
    category: expense.category,
    amount: expense.amount,
    currency: expense.currency,
    incurredAt: toIsoString(expense.incurredAt),
    kind: expense.kind,
    description: expense.description ?? undefined,
    relatedUnitId: expense.relatedUnit?.publicId ?? null,
    relatedEquipmentId: expense.relatedEquipment?.publicId ?? null,
    relatedOperatorId: expense.relatedOperator?.publicId ?? null,
    isOperationalProvision: expense.isOperationalProvision,
    invoiceRequired: expense.invoiceRequired,
    createdAt: toIsoString(expense.createdAt),
    updatedAt: toIsoString(expense.updatedAt),
  };
}
