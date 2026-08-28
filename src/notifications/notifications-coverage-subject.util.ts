import {
  COMPANY_ACTIVITY_KIND,
  NOTIFICATION_COMPUTED_KIND,
} from 'src/activity-events/company-activity-event.kinds';
import type { Expense } from 'src/expenses/entities/expense.entity';
import {
  buildExpenseCoverageNotificationSubject,
  coverageNotificationSubjectHasAsset,
} from 'src/expenses/expense-fleet-relation-label.util';
import {
  buildEquipmentOperationalId,
  buildUnitOperationalId,
} from 'src/common/utils/unit-operational-id.util';
import type { NotificationFeedItemDto } from './notifications-computed.util';

const PAYMENT_SUBJECT_ENRICH_KINDS = new Set<string>([
  COMPANY_ACTIVITY_KIND.PAYMENT_CONFIRMED,
  COMPANY_ACTIVITY_KIND.PAYMENT_REVERTED,
  COMPANY_ACTIVITY_KIND.COVERAGE_PAYMENT_CONFIRMED,
  NOTIFICATION_COMPUTED_KIND.PAYMENT_OVERDUE,
  NOTIFICATION_COMPUTED_KIND.PAYMENT_DUE_TODAY,
  NOTIFICATION_COMPUTED_KIND.PAYMENT_DUE_SOON,
]);

const PAYMENT_CONFIRM_KINDS = new Set<string>([
  COMPANY_ACTIVITY_KIND.PAYMENT_CONFIRMED,
  COMPANY_ACTIVITY_KIND.PAYMENT_REVERTED,
  COMPANY_ACTIVITY_KIND.COVERAGE_PAYMENT_CONFIRMED,
]);

export type FleetNotificationAsset = {
  id: number;
  trailerBrandAbbr?: string | null;
  trailerYear?: string | null;
  plate?: string | null;
};

function isPaymentReminderKind(kind: string): boolean {
  return (
    kind === NOTIFICATION_COMPUTED_KIND.PAYMENT_OVERDUE ||
    kind === NOTIFICATION_COMPUTED_KIND.PAYMENT_DUE_TODAY ||
    kind === NOTIFICATION_COMPUTED_KIND.PAYMENT_DUE_SOON
  );
}

function parsePositiveId(raw: string | null | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function fleetAssetCode(asset: FleetNotificationAsset): string {
  const code = buildUnitOperationalId({
    id: asset.id,
    trailerBrandAbbr: asset.trailerBrandAbbr ?? undefined,
    trailerYear: asset.trailerYear ?? undefined,
    plate: asset.plate ?? undefined,
  });
  if (code === String(asset.id)) {
    const plate = asset.plate?.trim();
    if (plate) {
      return plate;
    }
  }
  return code;
}

function fleetEquipmentCode(asset: FleetNotificationAsset): string {
  const code = buildEquipmentOperationalId({
    id: asset.id,
    trailerBrandAbbr: asset.trailerBrandAbbr ?? undefined,
    trailerYear: asset.trailerYear ?? undefined,
    plate: asset.plate ?? undefined,
  });
  if (code === String(asset.id)) {
    const plate = asset.plate?.trim();
    if (plate) {
      return plate;
    }
  }
  return code;
}

export function coveragePaymentEventNeedsAssetEnrich(
  item: NotificationFeedItemDto,
): boolean {
  if (!PAYMENT_SUBJECT_ENRICH_KINDS.has(item.kind)) {
    return false;
  }
  return item.entityType === 'expense' && Boolean(item.entityId?.trim());
}

export function coveragePaymentExpenseIdsToEnrich(
  items: readonly NotificationFeedItemDto[],
): number[] {
  const ids = new Set<number>();
  for (const item of items) {
    if (!coveragePaymentEventNeedsAssetEnrich(item)) {
      continue;
    }
    const id = parsePositiveId(item.entityId);
    if (id != null) {
      ids.add(id);
    }
  }
  return [...ids];
}

function coveragePaymentNeedsFleetAssetPrefix(
  item: NotificationFeedItemDto,
  entityType: 'unit' | 'equipment',
): boolean {
  if (!PAYMENT_CONFIRM_KINDS.has(item.kind)) {
    return false;
  }
  if (item.entityType !== entityType) {
    return false;
  }
  if (coverageNotificationSubjectHasAsset(item.subjectLabel)) {
    return false;
  }
  return parsePositiveId(item.entityId) != null;
}

export function coveragePaymentUnitIdsToPrefix(
  items: readonly NotificationFeedItemDto[],
): number[] {
  const ids = new Set<number>();
  for (const item of items) {
    if (!coveragePaymentNeedsFleetAssetPrefix(item, 'unit')) {
      continue;
    }
    ids.add(parsePositiveId(item.entityId) as number);
  }
  return [...ids];
}

export function coveragePaymentEquipmentIdsToPrefix(
  items: readonly NotificationFeedItemDto[],
): number[] {
  const ids = new Set<number>();
  for (const item of items) {
    if (!coveragePaymentNeedsFleetAssetPrefix(item, 'equipment')) {
      continue;
    }
    ids.add(parsePositiveId(item.entityId) as number);
  }
  return [...ids];
}

export function prefixCoveragePaymentSubjectWithFleetAsset(
  item: NotificationFeedItemDto,
  kind: 'unit' | 'equipment',
  asset: FleetNotificationAsset,
): NotificationFeedItemDto {
  const label =
    kind === 'equipment' ? fleetEquipmentCode(asset) : fleetAssetCode(asset);
  const prefix = kind === 'equipment' ? `Equipo ${label}` : `Unidad ${label}`;
  const detail = item.subjectLabel.trim();
  const subjectLabel =
    detail && !detail.includes(prefix) && !prefix.includes(detail)
      ? `${prefix} · ${detail}`
      : prefix || detail;
  return {
    ...item,
    subjectLabel,
    entityTab: item.entityTab ?? 'cob',
  };
}

export function applyCoveragePaymentAssetEnrich(
  item: NotificationFeedItemDto,
  expense: Expense,
): NotificationFeedItemDto {
  const subjectLabel = buildExpenseCoverageNotificationSubject(expense);
  if (isPaymentReminderKind(item.kind)) {
    return {
      ...item,
      subjectLabel,
      entityTab: item.entityTab ?? 'cob',
    };
  }
  const equipmentId =
    expense.relatedEquipmentId ?? expense.relatedEquipment?.id;
  const unitId = expense.relatedUnitId ?? expense.relatedUnit?.id;
  return {
    ...item,
    subjectLabel,
    ...(equipmentId != null
      ? {
          entityType: 'equipment',
          entityId: String(equipmentId),
          entityTab: 'cob',
        }
      : unitId != null
        ? {
            entityType: 'unit',
            entityId: String(unitId),
            entityTab: 'cob',
          }
        : {}),
  };
}

export function enrichCoveragePaymentFeedItems(
  items: readonly NotificationFeedItemDto[],
  expenses: readonly Expense[],
): NotificationFeedItemDto[] {
  if (expenses.length === 0) {
    return [...items];
  }
  const byId = new Map(expenses.map((expense) => [expense.id, expense]));
  return items.map((item) => {
    if (!coveragePaymentEventNeedsAssetEnrich(item)) {
      return item;
    }
    const expense = byId.get(Number(item.entityId));
    if (!expense) {
      return item;
    }
    return applyCoveragePaymentAssetEnrich(item, expense);
  });
}

export function enrichCoveragePaymentFleetAssetLabels(
  items: readonly NotificationFeedItemDto[],
  units: readonly FleetNotificationAsset[],
  equipment: readonly FleetNotificationAsset[],
): NotificationFeedItemDto[] {
  if (units.length === 0 && equipment.length === 0) {
    return [...items];
  }
  const unitsById = new Map(units.map((row) => [row.id, row]));
  const equipmentById = new Map(equipment.map((row) => [row.id, row]));
  return items.map((item) => {
    const id = parsePositiveId(item.entityId);
    if (id == null) {
      return item;
    }
    if (coveragePaymentNeedsFleetAssetPrefix(item, 'unit')) {
      const unit = unitsById.get(id);
      return unit
        ? prefixCoveragePaymentSubjectWithFleetAsset(item, 'unit', unit)
        : item;
    }
    if (coveragePaymentNeedsFleetAssetPrefix(item, 'equipment')) {
      const row = equipmentById.get(id);
      return row
        ? prefixCoveragePaymentSubjectWithFleetAsset(item, 'equipment', row)
        : item;
    }
    return item;
  });
}

