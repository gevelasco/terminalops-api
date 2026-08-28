import {
  buildEquipmentOperationalId,
  buildUnitOperationalId,
} from 'src/common/utils/unit-operational-id.util';
import type { Expense } from 'src/expenses/entities/expense.entity';
import { verificationScopeFromExpenseText } from 'src/expenses/expense-payload.util';
import { VERIFICATION_CATEGORY_BY_SCOPE } from 'src/expenses/expense-payload.util';

function verificationCategoryLabel(expense: Expense): string {
  const scope = verificationScopeFromExpenseText(
    expense.category,
    expense.description,
  );
  if (scope) {
    return VERIFICATION_CATEGORY_BY_SCOPE[scope];
  }
  return expense.category?.trim() || '';
}

/**
 * Cuando no se puede armar el código operativo (falta marca/año/placa),
 * `buildFleetOperationalCode` devuelve el id interno. En ese caso preferimos la
 * placa como identificador visible de la unidad/equipo en lugar del id crudo.
 */
function preferPlateOverInternalId(
  operationalCode: string,
  asset: { id: number; plate?: string | null },
): string {
  if (operationalCode === String(asset.id)) {
    const plate = asset.plate?.trim();
    if (plate) {
      return plate;
    }
  }
  return operationalCode;
}

function unitLabel(expense: Expense): string | undefined {
  if (expense.relatedUnit) {
    return preferPlateOverInternalId(
      buildUnitOperationalId(expense.relatedUnit),
      expense.relatedUnit,
    );
  }
  if (expense.relatedUnitId != null) {
    return String(expense.relatedUnitId);
  }
  return undefined;
}

function equipmentLabel(expense: Expense): string | undefined {
  if (expense.relatedEquipment) {
    return preferPlateOverInternalId(
      buildEquipmentOperationalId(expense.relatedEquipment),
      expense.relatedEquipment,
    );
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
  const scopeLabel = verificationCategoryLabel(expense);
  return scopeLabel ? `${base} · ${scopeLabel}` : base;
}

function tripLinkedUnitLabel(expense: Expense): string | undefined {
  const direct = unitLabel(expense);
  if (direct) {
    return direct;
  }
  if (expense.trip?.unit) {
    return buildUnitOperationalId(expense.trip.unit);
  }
  return undefined;
}

function tripLinkedOperatorLabel(expense: Expense): string | undefined {
  const direct = operatorLabel(expense);
  if (direct) {
    return direct;
  }
  return expense.trip?.operator?.name?.trim() || undefined;
}

export function coverageNotificationSubjectHasAsset(subject: string): boolean {
  const trimmed = subject.trim();
  return /^Unidad\s/i.test(trimmed) || /^Equipo\s/i.test(trimmed);
}

export function formatExpenseNotificationAmount(
  amount: string | number | null | undefined,
  currency = 'MXN',
): string | undefined {
  const n =
    typeof amount === 'number'
      ? amount
      : Number(String(amount ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) {
    return undefined;
  }
  const code = (currency ?? 'MXN').trim() || 'MXN';
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export type ScheduledPaymentNotificationSubjectInput = {
  id?: number;
  description?: string | null;
  category?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  unitLabel?: string | null;
  equipmentLabel?: string | null;
  relatedUnitId?: number | null;
  relatedEquipmentId?: number | null;
};

function scheduledPaymentAssetDisplay(
  input: ScheduledPaymentNotificationSubjectInput,
): string | undefined {
  if (input.relatedEquipmentId != null || input.equipmentLabel?.trim()) {
    const label = input.equipmentLabel?.trim() || String(input.relatedEquipmentId ?? '');
    return label ? `Equipo ${label}` : undefined;
  }
  const label = input.unitLabel?.trim() || (input.relatedUnitId != null ? String(input.relatedUnitId) : '');
  return label ? `Unidad ${label}` : undefined;
}

function joinNotificationSubjectParts(
  parts: Array<string | undefined>,
  fallback: string,
): string {
  const unique: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) {
      continue;
    }
    if (unique.some((existing) => existing.includes(trimmed) || trimmed.includes(existing))) {
      continue;
    }
    unique.push(trimmed);
  }
  return unique.join(' · ') || fallback;
}

/** Unidad/equipo + detalle (mes) + monto, para avisos de cobertura y cuotas. */
export function buildScheduledPaymentNotificationSubject(
  input: ScheduledPaymentNotificationSubjectInput,
): string {
  const asset = scheduledPaymentAssetDisplay(input);
  const detail = input.description?.trim() || input.category?.trim() || '';
  const money = formatExpenseNotificationAmount(input.amount, input.currency ?? 'MXN');
  return joinNotificationSubjectParts(
    [asset, detail, money],
    input.id != null ? `Gasto #${input.id}` : '—',
  );
}

/**
 * Asunto de notificación de cobertura: unidad/equipo + póliza u otro detalle
 * del gasto, para identificar el activo de un vistazo.
 */
export function buildExpenseCoverageNotificationSubject(
  expense: Expense,
): string {
  return buildScheduledPaymentNotificationSubject({
    id: expense.id,
    description: expense.description,
    category: expense.category,
    amount: expense.amount,
    currency: expense.currency,
    unitLabel: unitLabel(expense),
    equipmentLabel: equipmentLabel(expense),
    relatedUnitId: expense.relatedUnitId ?? expense.relatedUnit?.id ?? null,
    relatedEquipmentId:
      expense.relatedEquipmentId ?? expense.relatedEquipment?.id ?? null,
  });
}

/** Etiqueta legible del vínculo operativo para listado y detalle de gastos. */
export function buildExpenseFleetRelationLabel(expense: Expense): string | undefined {
  switch (expense.kind) {
    case 'trip':
      return undefined;
    case 'fuel':
    case 'tolls':
      return tripLinkedUnitLabel(expense);
    case 'per_diem':
    case 'lodging':
      return tripLinkedOperatorLabel(expense) ?? tripLinkedUnitLabel(expense);
    case 'maintenance':
      return expense.relatedEquipmentId != null
        ? equipmentLabel(expense)
        : unitLabel(expense);
    case 'tires':
    case 'gps':
    case 'unit_purchase':
    case 'unit_rent':
      return unitLabel(expense);
    case 'insurance':
    case 'tenure_payment':
      return expense.relatedEquipmentId != null
        ? equipmentLabel(expense)
        : unitLabel(expense);
    case 'verification':
      return withVerificationSuffix(
        expense,
        expense.relatedEquipmentId != null
          ? equipmentLabel(expense)
          : unitLabel(expense),
      );
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
  return tripLinkedUnitLabel(expense);
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
