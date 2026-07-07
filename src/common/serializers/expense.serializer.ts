import { Expense } from 'src/expenses/entities/expense.entity';
import {
  buildExpenseFleetRelationLabel,
  buildExpenseRelatedEquipmentLabel,
  buildExpenseRelatedOperatorLabel,
  buildExpenseRelatedUnitLabel,
} from 'src/expenses/expense-fleet-relation-label.util';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import { toIsoString } from 'src/common/utils/iso-date.util';

export function serializeExpense(expense: Expense): Record<string, unknown> {
  const fleetRelationLabel = buildExpenseFleetRelationLabel(expense);
  const relatedUnitLabel = buildExpenseRelatedUnitLabel(expense);
  const relatedEquipmentLabel = buildExpenseRelatedEquipmentLabel(expense);
  const relatedOperatorLabel = buildExpenseRelatedOperatorLabel(expense);

  return {
    id: expense.id,
    companyId: expense.companyId,
    tripId: expense.trip?.id ?? expense.tripId ?? null,
    tripManeuverCode: expense.trip?.maneuverCode?.trim() || undefined,
    fleetRelationLabel,
    relatedUnitLabel,
    relatedEquipmentLabel,
    relatedOperatorLabel,
    category: expense.category,
    amount: expense.amount,
    currency: expense.currency,
    incurredAt: toIsoString(expense.incurredAt),
    incurredDate: formatOperationalIncurredDateYmd(expense.incurredAt),
    kind: expense.kind,
    description: expense.description ?? undefined,
    vendor: expense.vendor ?? undefined,
    paymentMethod: expense.paymentMethod ?? undefined,
    maintenanceTarget: expense.maintenanceTarget ?? undefined,
    insuranceTarget: expense.insuranceTarget ?? undefined,
    verificationScope: expense.verificationScope ?? undefined,
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
