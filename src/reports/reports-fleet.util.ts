import type {
  FleetOverviewItemDto,
  FleetOverviewOperationalStatus,
  FleetOverviewRenewalStatus,
} from 'src/fleet/dto/fleet-overview.dto';
import type {
  ReportsFleetComplianceUnitRowDto,
  ReportsFleetStatusMixRowDto,
} from './dto/reports-fleet.dto';

const FLEET_STATUS_LABELS: Record<FleetOverviewOperationalStatus, string> = {
  in_transit: 'En ruta',
  scheduled: 'Programado',
  available: 'Disponible',
  maintenance: 'Mantenimiento',
};

const STATUS_MIX_ORDER: FleetOverviewOperationalStatus[] = [
  'in_transit',
  'scheduled',
  'available',
  'maintenance',
];

function renewalRank(status: FleetOverviewRenewalStatus): number {
  if (status === 'due') {
    return 3;
  }
  if (status === 'soon') {
    return 2;
  }
  if (status === 'ok') {
    return 1;
  }
  return 0;
}

function unitUrgencyScore(maint: FleetOverviewItemDto['maintenance']): number {
  if (!maint) {
    return 0;
  }
  return Math.max(
    renewalRank(maint.maintenanceRenewal ?? 'na'),
    renewalRank(maint.inspectionRenewal ?? 'na'),
    renewalRank(maint.insuranceRenewal ?? 'na'),
  );
}

export function buildReportsFleetComplianceUnits(
  items: readonly FleetOverviewItemDto[],
): ReportsFleetComplianceUnitRowDto[] {
  return [...items]
    .map((item) => {
      const maint = item.maintenance;
      return {
        unitCode: item.unitName,
        unitId: item.unitId,
        maintenanceRenewal: maint?.maintenanceRenewal ?? 'na',
        maintenanceNext: maint?.nextMaintenanceDate ?? null,
        verificationRenewal: maint?.inspectionRenewal ?? 'na',
        verificationNext: maint?.inspectionStatus ?? null,
        insuranceRenewal: maint?.insuranceRenewal ?? 'na',
        insuranceNext: maint?.insuranceStatus ?? null,
        urgencyScore: unitUrgencyScore(maint),
      };
    })
    .sort((a, b) => {
      const byUrgency = b.urgencyScore - a.urgencyScore;
      if (byUrgency !== 0) {
        return byUrgency;
      }
      return a.unitCode.localeCompare(b.unitCode, 'es');
    })
    .map(({ urgencyScore: _urgencyScore, ...row }) => row);
}

export function buildReportsFleetStatusMix(
  items: readonly FleetOverviewItemDto[],
): ReportsFleetStatusMixRowDto[] {
  const counts = new Map<FleetOverviewOperationalStatus, number>();
  for (const item of items) {
    counts.set(item.operationalStatus, (counts.get(item.operationalStatus) ?? 0) + 1);
  }
  return STATUS_MIX_ORDER.map((status) => ({
    status,
    label: FLEET_STATUS_LABELS[status],
    count: counts.get(status) ?? 0,
  })).filter((row) => row.count > 0);
}

export function computeAvgDaysWithoutOperation(
  items: readonly FleetOverviewItemDto[],
): number {
  if (items.length === 0) {
    return 0;
  }
  const total = items.reduce((sum, item) => {
    if (
      item.operationalStatus === 'in_transit' ||
      item.operationalStatus === 'scheduled'
    ) {
      return sum;
    }
    return sum + Math.max(0, item.daysWithoutManeuver ?? 0);
  }, 0);
  return Math.round((total / items.length) * 10) / 10;
}

export { FLEET_STATUS_LABELS };
