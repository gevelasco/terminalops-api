import { COMPANY_ACTIVITY_KIND } from './company-activity-event.kinds';
import { fleetMetaFieldProvided } from 'src/fleet/fleet-meta-expense-sync-scope.util';

export type FleetActivityAsset = 'unit' | 'equipment';
export type FleetActivitySection = 'ficha' | 'coverage' | 'maintenance';

const SECTION_TITLE: Record<FleetActivitySection, string> = {
  ficha: 'Ficha técnica',
  coverage: 'Cobertura',
  maintenance: 'Mantenimiento',
};

const UNIT_SECTION_KIND: Record<FleetActivitySection, string> = {
  ficha: COMPANY_ACTIVITY_KIND.UNIT_FICHA_UPDATED,
  coverage: COMPANY_ACTIVITY_KIND.UNIT_COVERAGE_UPDATED,
  maintenance: COMPANY_ACTIVITY_KIND.UNIT_MAINTENANCE_UPDATED,
};

const EQUIPMENT_SECTION_KIND: Record<FleetActivitySection, string> = {
  ficha: COMPANY_ACTIVITY_KIND.EQUIPMENT_FICHA_UPDATED,
  coverage: COMPANY_ACTIVITY_KIND.EQUIPMENT_COVERAGE_UPDATED,
  maintenance: COMPANY_ACTIVITY_KIND.EQUIPMENT_MAINTENANCE_UPDATED,
};

function bucketForFleetMetaKey(key: string): FleetActivitySection {
  if (
    key.startsWith('insurance') ||
    key.startsWith('gps') ||
    key.startsWith('verification') ||
    key === 'hasGps' ||
    key === 'clearedVerificationScopes'
  ) {
    return 'coverage';
  }
  if (
    key.startsWith('lastMaintenance') ||
    key.startsWith('maintenance') ||
    key === 'tireCondition'
  ) {
    return 'maintenance';
  }
  return 'ficha';
}

export function fleetMetaPatchSection(
  incomingMeta: object | undefined,
): FleetActivitySection {
  if (!incomingMeta) {
    return 'ficha';
  }
  const buckets = new Set<FleetActivitySection>();
  for (const key of Object.keys(incomingMeta)) {
    if (!fleetMetaFieldProvided(incomingMeta, key)) {
      continue;
    }
    buckets.add(bucketForFleetMetaKey(key));
  }
  if (buckets.has('coverage') && buckets.size === 1) {
    return 'coverage';
  }
  if (buckets.has('maintenance') && buckets.size === 1) {
    return 'maintenance';
  }
  if (buckets.has('coverage')) {
    return 'coverage';
  }
  if (buckets.has('maintenance')) {
    return 'maintenance';
  }
  return 'ficha';
}

export function fleetPatchActivity(
  asset: FleetActivityAsset,
  incomingMeta: object | undefined,
): { kind: string; title: string } {
  const section = fleetMetaPatchSection(incomingMeta);
  const kinds = asset === 'equipment' ? EQUIPMENT_SECTION_KIND : UNIT_SECTION_KIND;
  return {
    kind: kinds[section],
    title: SECTION_TITLE[section],
  };
}
