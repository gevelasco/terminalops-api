import {
  addDaysYmd,
  operationalYmd,
} from './client-balance-operational-date.util';
import {
  isTripBillableForReporting,
  isTripClientCollected,
  tripCreditReceivable,
  tripDueDate,
  tripKm,
  tripRevenue,
  tripResolvedDirectCost,
  type ClientBalanceExpenseRow,
  type ClientBalanceTripRow,
  type ClientBalanceTripStatus,
} from './client-balance-trip.util';

export type ClientPaymentDueBadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

export interface ClientManeuverStatusCountsDto {
  completed: number;
  inTransit: number;
  scheduled: number;
  cancelled: number;
  total: number;
}

export interface ClientUpcomingPaymentRowDto {
  tripId: string;
  maneuverCode: string;
  dueYmd: string;
  dueLabel: string;
  amount: number;
  badgeVariant: ClientPaymentDueBadgeVariant;
  statusHint: string;
}

export interface ClientPaymentHistoryRowDto {
  tripId: string;
  maneuverCode: string;
  collectedYmd: string;
  collectedLabel: string;
  amount: number;
}

export interface ClientBalanceSummaryDto {
  hasTrips: boolean;
  hasBillable: boolean;
  statusCounts: ClientManeuverStatusCountsDto;
  completedCount: number;
  totalKm: number;
  collected: number;
  receivable: number;
  totalRevenue: number;
  directCost: number;
  margin: number;
  marginPct: number;
  nextDueYmd: string | null;
  nextDueLabel: string;
  nextDueBadgeVariant: ClientPaymentDueBadgeVariant;
  upcomingPayments: ClientUpcomingPaymentRowDto[];
  paymentHistory: ClientPaymentHistoryRowDto[];
}

export type ClientCommercialHealthDto =
  | 'watch_list'
  | 'good_standing'
  | 'restricted';

export interface ClientBalanceOverviewItemDto {
  clientId: string;
  summary: ClientBalanceSummaryDto;
  commercialHealth: ClientCommercialHealthDto;
}

export interface ClientBalanceOverviewResponseDto {
  asOf: string;
  items: ClientBalanceOverviewItemDto[];
}

function tripMatchesClient(trip: ClientBalanceTripRow, clientId: string): boolean {
  const id = clientId.trim();
  if (!id) {
    return false;
  }
  return trip.clientId.trim() === id;
}

function dateLabel(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return ymd;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function dateLabelFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function dueBadgeVariant(
  dueYmd: string,
  asOfYmd: string,
): ClientPaymentDueBadgeVariant {
  if (dueYmd < asOfYmd) {
    return 'danger';
  }
  if (dueYmd <= addDaysYmd(asOfYmd, 7)) {
    return 'warning';
  }
  return 'success';
}

function dueStatusHint(dueYmd: string, asOfYmd: string): string {
  if (dueYmd < asOfYmd) {
    return 'Vencido';
  }
  if (dueYmd <= addDaysYmd(asOfYmd, 7)) {
    return 'Vence pronto';
  }
  return 'Programado';
}

function countByStatus(
  trips: readonly ClientBalanceTripRow[],
): ClientManeuverStatusCountsDto {
  const counts: Record<ClientBalanceTripStatus, number> = {
    completed: 0,
    in_transit: 0,
    scheduled: 0,
    cancelled: 0,
  };
  for (const trip of trips) {
    counts[trip.status] = (counts[trip.status] ?? 0) + 1;
  }
  return {
    completed: counts.completed,
    inTransit: counts.in_transit,
    scheduled: counts.scheduled,
    cancelled: counts.cancelled,
    total: trips.length,
  };
}

export function deriveClientCommercialHealthFromSummary(
  summary: ClientBalanceSummaryDto,
): ClientCommercialHealthDto {
  if (!summary.hasTrips) {
    return 'watch_list';
  }
  const hasOverdue = summary.upcomingPayments.some(
    (row) => row.badgeVariant === 'danger',
  );
  if (hasOverdue) {
    return 'restricted';
  }
  return 'good_standing';
}

export function buildClientBalanceSummary(
  clientId: string,
  trips: readonly ClientBalanceTripRow[],
  expenses: readonly ClientBalanceExpenseRow[] = [],
  asOf: Date = new Date(),
): ClientBalanceSummaryDto {
  const subset = trips.filter((trip) => tripMatchesClient(trip, clientId));
  const billable = subset.filter((trip) => isTripBillableForReporting(trip));
  const completed = subset.filter((trip) => trip.status === 'completed');
  const asOfYmd = operationalYmd(asOf);

  const collected = billable.reduce(
    (sum, trip) => sum + (isTripClientCollected(trip) ? tripRevenue(trip) : 0),
    0,
  );
  const receivable = billable.reduce(
    (sum, trip) => sum + tripCreditReceivable(trip),
    0,
  );
  const totalRevenue = billable.reduce((sum, trip) => sum + tripRevenue(trip), 0);
  const directCost = billable.reduce(
    (sum, trip) => sum + tripResolvedDirectCost(trip, expenses),
    0,
  );
  const margin = totalRevenue - directCost;
  const marginPct =
    totalRevenue > 0 ? Math.round((margin / totalRevenue) * 100) : 0;
  const totalKm = completed.reduce((sum, trip) => sum + tripKm(trip), 0);

  const paymentHistory: ClientPaymentHistoryRowDto[] = [];
  for (const trip of billable) {
    if (!isTripClientCollected(trip)) {
      continue;
    }
    const iso = (trip.clientCollectedAt ?? '').trim();
    if (!iso) {
      continue;
    }
    const collectedYmd = operationalYmd(new Date(iso));
    paymentHistory.push({
      tripId: trip.id,
      maneuverCode: trip.maneuverCode,
      collectedYmd,
      collectedLabel: dateLabelFromIso(iso),
      amount: tripRevenue(trip),
    });
  }
  paymentHistory.sort((a, b) => b.collectedYmd.localeCompare(a.collectedYmd));

  const upcomingPayments: ClientUpcomingPaymentRowDto[] = [];
  let nextDueYmd: string | null = null;

  for (const trip of billable) {
    const amount = tripCreditReceivable(trip);
    if (amount <= 0) {
      continue;
    }
    const due = tripDueDate(trip);
    const dueYmd = due ? operationalYmd(due) : asOfYmd;
    if (!nextDueYmd || dueYmd < nextDueYmd) {
      nextDueYmd = dueYmd;
    }
    upcomingPayments.push({
      tripId: trip.id,
      maneuverCode: trip.maneuverCode,
      dueYmd,
      dueLabel: dateLabel(dueYmd),
      amount,
      badgeVariant: dueBadgeVariant(dueYmd, asOfYmd),
      statusHint: dueStatusHint(dueYmd, asOfYmd),
    });
  }
  upcomingPayments.sort((a, b) => a.dueYmd.localeCompare(b.dueYmd));

  const nextDueBadgeVariant = nextDueYmd
    ? dueBadgeVariant(nextDueYmd, asOfYmd)
    : 'neutral';

  return {
    hasTrips: subset.length > 0,
    hasBillable: billable.length > 0,
    statusCounts: countByStatus(subset),
    completedCount: completed.length,
    totalKm: Math.round(totalKm),
    collected,
    receivable,
    totalRevenue,
    directCost,
    margin,
    marginPct,
    nextDueYmd,
    nextDueLabel: nextDueYmd ? dateLabel(nextDueYmd) : '—',
    nextDueBadgeVariant,
    upcomingPayments,
    paymentHistory,
  };
}

export function buildClientBalanceOverview(
  clientIds: readonly string[],
  trips: readonly ClientBalanceTripRow[],
  expenses: readonly ClientBalanceExpenseRow[],
  asOf: Date = new Date(),
): ClientBalanceOverviewResponseDto {
  const items: ClientBalanceOverviewItemDto[] = [...clientIds]
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((clientId) => {
      const summary = buildClientBalanceSummary(clientId, trips, expenses, asOf);
      return {
        clientId,
        summary,
        commercialHealth: deriveClientCommercialHealthFromSummary(summary),
      };
    });

  return {
    asOf: asOf.toISOString(),
    items,
  };
}
