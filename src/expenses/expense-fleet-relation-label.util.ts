import {
  buildEquipmentOperationalId,
  buildUnitOperationalId,
} from 'src/common/utils/unit-operational-id.util';
import type { Expense } from 'src/expenses/entities/expense.entity';

const VERIFICATION_SCOPE_LABELS: Record<string, string> = {
  phys_mech: 'Verificación físico-mecánica',
  emissions: 'Verificación de emisiones',
  double_articulated: 'Doble articulado (SPP)',
};

function verificationScopeLabel(scope: string | null | undefined): string {
  const code = scope?.trim();
  if (!code) {
    return '';
  }
  return VERIFICATION_SCOPE_LABELS[code] ?? code;
}

function unitLabel(expense: Expense): string | undefined {
  if (expense.relatedUnit) {
    return buildUnitOperationalId(expense.relatedUnit);
  }
  if (expense.relatedUnitId != null) {
    return String(expense.relatedUnitId);
  }
  return undefined;
}

function equipmentLabel(expense: Expense): string | undefined {
  if (expense.relatedEquipment) {
    return buildEquipmentOperationalId(expense.relatedEquipment);
  }
  if (expense.relatedEquipmentId != null) {
    return String(expense.relatedEquipmentId);
  }
  return undefined;
}

function operatorLabel(expense: Expense): string | undefined {
  const name = expense.relatedOperator?.name?.trim();
  if (name) {
    return name;
  }
  if (expense.relatedOperatorId != null) {
    return String(expense.relatedOperatorId);
  }
  return undefined;
}

function withVerificationSuffix(
  expense: Expense,
  base: string | undefined,
): string | undefined {
  if (!base) {
    return undefined;
  }
  if (expense.kind !== 'verification') {
    return base;
  }
  const scopeLabel = verificationScopeLabel(expense.verificationScope);
  return scopeLabel ? `${base} · ${scopeLabel}` : base;
}

/** Etiqueta legible del vínculo operativo para listado y detalle de gastos. */
export function buildExpenseFleetRelationLabel(expense: Expense): string | undefined {
  switch (expense.kind) {
    case 'trip':
      return undefined;
    case 'maintenance':
      if (expense.maintenanceTarget === 'equipment') {
        return equipmentLabel(expense);
      }
      return unitLabel(expense);
    case 'tires':
    case 'gps':
    case 'unit_purchase':
    case 'unit_rent':
      return unitLabel(expense);
    case 'insurance':
      if (expense.insuranceTarget === 'equipment') {
        return equipmentLabel(expense);
      }
      return unitLabel(expense);
    case 'verification':
      return withVerificationSuffix(expense, unitLabel(expense));
    case 'equipment_purchase':
    case 'equipment_rent':
    case 'trailer_admin_payout':
      return equipmentLabel(expense);
    case 'operator_payment':
    case 'operator_commission':
      return operatorLabel(expense);
    default:
      return undefined;
  }
}

export function buildExpenseRelatedUnitLabel(expense: Expense): string | undefined {
  return unitLabel(expense);
}

export function buildExpenseRelatedEquipmentLabel(
  expense: Expense,
): string | undefined {
  return equipmentLabel(expense);
}

export function buildExpenseRelatedOperatorLabel(
  expense: Expense,
): string | undefined {
  return operatorLabel(expense);
}
