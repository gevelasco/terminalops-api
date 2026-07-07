import { BadRequestException } from '@nestjs/common';

export const EXPENSE_MAINTENANCE_TARGETS = ['unit', 'equipment'] as const;
export type ExpenseMaintenanceTarget = (typeof EXPENSE_MAINTENANCE_TARGETS)[number];

export const EXPENSE_VERIFICATION_SCOPES = [
  'phys_mech',
  'emissions',
  'double_articulated',
] as const;
export type ExpenseVerificationScope = (typeof EXPENSE_VERIFICATION_SCOPES)[number];

const MAINTENANCE_TARGET_SET = new Set<string>(EXPENSE_MAINTENANCE_TARGETS);
const VERIFICATION_SCOPE_SET = new Set<string>(EXPENSE_VERIFICATION_SCOPES);

export type ExpenseRelationInput = {
  kind: string;
  maintenanceTarget?: string | null;
  insuranceTarget?: string | null;
  verificationScope?: string | null;
  relatedUnitId?: number | null;
  relatedEquipmentId?: number | null;
};

export type NormalizedExpenseRelationFields = {
  maintenanceTarget: string | null;
  insuranceTarget: string | null;
  verificationScope: string | null;
};

export type ExpenseRelationMergeSource = {
  kind: string;
  maintenanceTarget?: string | null;
  insuranceTarget?: string | null;
  verificationScope?: string | null;
  relatedUnitId?: number | null;
  relatedEquipmentId?: number | null;
};

export function normalizeExpenseOptionalText(value?: string | null): string | undefined {
  if (value == null) {
    return undefined;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Nullable text column: empty string → null. */
export function expenseTextColumn(value?: string | null): string | null {
  return normalizeExpenseOptionalText(value) ?? null;
}

function hasResourceId(id?: number | null): boolean {
  return id != null && Number.isFinite(id) && id > 0;
}

export function normalizeExpenseRelationFields(
  input: ExpenseRelationInput,
): NormalizedExpenseRelationFields {
  const kind = input.kind.trim();

  if (kind === 'maintenance') {
    const target = input.maintenanceTarget?.trim();
    if (!target || !MAINTENANCE_TARGET_SET.has(target)) {
      throw new BadRequestException(
        'Los gastos de mantenimiento requieren maintenanceTarget (unit o equipment).',
      );
    }
    if (target === 'unit' && !hasResourceId(input.relatedUnitId)) {
      throw new BadRequestException(
        'Mantenimiento en unidad requiere relatedUnitId.',
      );
    }
    if (target === 'equipment' && !hasResourceId(input.relatedEquipmentId)) {
      throw new BadRequestException(
        'Mantenimiento en equipo requiere relatedEquipmentId.',
      );
    }
    return {
      maintenanceTarget: target,
      insuranceTarget: null,
      verificationScope: null,
    };
  }

  if (kind === 'insurance') {
    const target = input.insuranceTarget?.trim();
    if (!target || !MAINTENANCE_TARGET_SET.has(target)) {
      throw new BadRequestException(
        'Los gastos de seguro requieren insuranceTarget (unit o equipment).',
      );
    }
    if (target === 'unit' && !hasResourceId(input.relatedUnitId)) {
      throw new BadRequestException(
        'Seguro de unidad requiere relatedUnitId.',
      );
    }
    if (target === 'equipment' && !hasResourceId(input.relatedEquipmentId)) {
      throw new BadRequestException(
        'Seguro de equipo requiere relatedEquipmentId.',
      );
    }
    return {
      maintenanceTarget: null,
      insuranceTarget: target,
      verificationScope: null,
    };
  }

  if (kind === 'verification') {
    const scope = input.verificationScope?.trim();
    if (!scope || !VERIFICATION_SCOPE_SET.has(scope)) {
      throw new BadRequestException(
        'Los gastos de verificación requieren verificationScope.',
      );
    }
    if (!hasResourceId(input.relatedUnitId)) {
      throw new BadRequestException(
        'Verificación requiere relatedUnitId.',
      );
    }
    return {
      maintenanceTarget: null,
      insuranceTarget: null,
      verificationScope: scope,
    };
  }

  return {
    maintenanceTarget: null,
    insuranceTarget: null,
    verificationScope: null,
  };
}

export function mergeExpenseRelationForNormalize(
  existing: ExpenseRelationMergeSource,
  patch: Partial<{
    kind?: string;
    maintenanceTarget?: string | null;
    insuranceTarget?: string | null;
    verificationScope?: string | null;
  }>,
  relatedIds: {
    relatedUnitId?: number | null;
    relatedEquipmentId?: number | null;
    relatedUnitIdTouched: boolean;
    relatedEquipmentIdTouched: boolean;
  },
): ExpenseRelationInput {
  return {
    kind: patch.kind ?? existing.kind,
    maintenanceTarget:
      patch.maintenanceTarget !== undefined
        ? patch.maintenanceTarget
        : existing.maintenanceTarget,
    insuranceTarget:
      patch.insuranceTarget !== undefined
        ? patch.insuranceTarget
        : existing.insuranceTarget,
    verificationScope:
      patch.verificationScope !== undefined
        ? patch.verificationScope
        : existing.verificationScope,
    relatedUnitId: relatedIds.relatedUnitIdTouched
      ? (relatedIds.relatedUnitId ?? null)
      : (existing.relatedUnitId ?? null),
    relatedEquipmentId: relatedIds.relatedEquipmentIdTouched
      ? (relatedIds.relatedEquipmentId ?? null)
      : (existing.relatedEquipmentId ?? null),
  };
}
