import { BadRequestException } from '@nestjs/common';

export const EXPENSE_FLEET_TARGETS = ['unit', 'equipment'] as const;
export type ExpenseFleetTarget = (typeof EXPENSE_FLEET_TARGETS)[number];

/** @deprecated alias — prefer ExpenseFleetTarget */
export type ExpenseMaintenanceTarget = ExpenseFleetTarget;
export const EXPENSE_MAINTENANCE_TARGETS = EXPENSE_FLEET_TARGETS;

export const EXPENSE_VERIFICATION_SCOPES = [
  'phys_mech',
  'emissions',
  'double_articulated',
] as const;
export type ExpenseVerificationScope = (typeof EXPENSE_VERIFICATION_SCOPES)[number];

const VERIFICATION_SCOPE_SET = new Set<string>(EXPENSE_VERIFICATION_SCOPES);

/** Categorías canónicas (estilo GPS: "GPS - mensual"). */
export const VERIFICATION_CATEGORY_BY_SCOPE: Record<
  ExpenseVerificationScope,
  string
> = {
  phys_mech: 'Verificación - físico-mecánica',
  emissions: 'Verificación - emisiones',
  double_articulated: 'Verificación - doble articulado',
};

export function verificationCategoryForScope(
  scope: ExpenseVerificationScope,
): string {
  return VERIFICATION_CATEGORY_BY_SCOPE[scope];
}

export function verificationDescriptionForScope(
  scope: ExpenseVerificationScope,
): string {
  return `Pago de verificación - ${
    scope === 'phys_mech'
      ? 'físico-mecánica'
      : scope === 'emissions'
        ? 'emisiones'
        : 'doble articulado'
  }`;
}

/** Resuelve scope desde category (y description como fallback). */
export function verificationScopeFromExpenseText(
  category?: string | null,
  description?: string | null,
): ExpenseVerificationScope | null {
  const haystack = `${category ?? ''} ${description ?? ''}`.toLowerCase();
  if (!haystack.trim()) {
    return null;
  }
  if (
    haystack.includes('físico-mecánica') ||
    haystack.includes('fisico-mecanica') ||
    haystack.includes('fisico-mecánica')
  ) {
    return 'phys_mech';
  }
  if (haystack.includes('emisiones')) {
    return 'emissions';
  }
  if (haystack.includes('doble articulado') || haystack.includes('spp')) {
    return 'double_articulated';
  }
  return null;
}

export function isExpenseVerificationScope(
  scope: string | null | undefined,
): scope is ExpenseVerificationScope {
  return !!scope && VERIFICATION_SCOPE_SET.has(scope);
}

export function isOperationalProvisionKind(kind: string | null | undefined): boolean {
  return (kind ?? '').trim() === 'operational_control';
}

/** Target flota a partir de FKs (equipment gana si ambos). */
export function expenseFleetTargetFromRelatedIds(params: {
  relatedUnitId?: number | null;
  relatedEquipmentId?: number | null;
}): ExpenseFleetTarget | null {
  if (hasResourceId(params.relatedEquipmentId)) {
    return 'equipment';
  }
  if (hasResourceId(params.relatedUnitId)) {
    return 'unit';
  }
  return null;
}

export type ExpenseRelationInput = {
  kind: string;
  relatedUnitId?: number | null;
  relatedEquipmentId?: number | null;
  /** Solo UI/create: se traduce a category canónica. */
  verificationScope?: string | null;
  category?: string | null;
};

export type NormalizedExpenseRelationFields = {
  category?: string;
  descriptionHint?: string;
};

function hasResourceId(id?: number | null): boolean {
  return id != null && Number.isFinite(id) && id > 0;
}

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

/**
 * Valida FKs por kind. Para verificación, asegura category canónica
 * (desde verificationScope o category parseable).
 */
export function normalizeExpenseRelationFields(
  input: ExpenseRelationInput,
): NormalizedExpenseRelationFields {
  const kind = input.kind.trim();

  if (kind === 'maintenance' || kind === 'insurance') {
    const target = expenseFleetTargetFromRelatedIds(input);
    if (!target) {
      throw new BadRequestException(
        kind === 'maintenance'
          ? 'Los gastos de mantenimiento requieren unidad o equipo relacionado.'
          : 'Los gastos de seguro requieren unidad o equipo relacionado.',
      );
    }
    if (target === 'unit' && hasResourceId(input.relatedEquipmentId)) {
      // equipment gana: ok
    }
    return {};
  }

  if (kind === 'verification') {
    if (!hasResourceId(input.relatedUnitId) && !hasResourceId(input.relatedEquipmentId)) {
      throw new BadRequestException(
        'Verificación requiere unidad o equipo relacionado.',
      );
    }
    const fromScope = input.verificationScope?.trim();
    let scope: ExpenseVerificationScope | null = null;
    if (fromScope && isExpenseVerificationScope(fromScope)) {
      scope = fromScope;
    } else {
      scope = verificationScopeFromExpenseText(input.category);
    }
    if (!scope) {
      throw new BadRequestException(
        'Los gastos de verificación requieren categoría (físico-mecánica, emisiones o doble articulado).',
      );
    }
    return {
      category: verificationCategoryForScope(scope),
      descriptionHint: verificationDescriptionForScope(scope),
    };
  }

  return {};
}

export function mergeExpenseRelationForNormalize(
  existing: {
    kind: string;
    relatedUnitId?: number | null;
    relatedEquipmentId?: number | null;
    category?: string | null;
  },
  patch: Partial<{
    kind?: string;
    verificationScope?: string | null;
    category?: string | null;
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
    category:
      patch.category !== undefined ? patch.category : existing.category,
    verificationScope: patch.verificationScope,
    relatedUnitId: relatedIds.relatedUnitIdTouched
      ? (relatedIds.relatedUnitId ?? null)
      : (existing.relatedUnitId ?? null),
    relatedEquipmentId: relatedIds.relatedEquipmentIdTouched
      ? (relatedIds.relatedEquipmentId ?? null)
      : (existing.relatedEquipmentId ?? null),
  };
}
