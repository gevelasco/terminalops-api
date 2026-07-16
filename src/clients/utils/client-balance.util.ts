import {
  addDaysYmd,
  operationalYmd,
} from './client-balance-operational-date.util';
import { parseMoney } from './client-balance-money.util';
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
  dueYmd: string;
  dueLabel: string;
  collectedYmd: string;
  collectedLabel: string;
  amount: number;
  delayDays: number;
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
  avgDelayDays: number | null;
  volumeMonthsWindow: number;
  volumeBillableCount: number;
  volumeAllCount: number;
  volumeManeuversPerMonth: number;
  volumeBilledPerMonth: number;
  volumeOperationalPerMonth: number;
  volumeProfitPerMonth: number;
}

export interface ClientBalancePeriodSummaryDto {
  from: string;
  to: string;
  paymentHistory: ClientPaymentHistoryRowDto[];
  statusCounts: ClientManeuverStatusCountsDto;
  completedCount: number;
  totalKm: number;
  volumeMonthsWindow: number;
  volumeBillableCount: number;
  volumeAllCount: number;
  volumeManeuversPerMonth: number;
  volumeBilledPerMonth: number;
  volumeOperationalPerMonth: number;
  volumeProfitPerMonth: number;
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
  const delayDaysSamples: number[] = [];

  for (const trip of billable) {
    const due = tripDueDate(trip);

    if (isTripClientCollected(trip)) {
      const iso = (trip.clientCollectedAt ?? '').trim();
      if (!iso) {
        continue;
      }
      const collectedDate = new Date(iso);
      const collectedYmd = operationalYmd(collectedDate);
      const dueYmd = due ? operationalYmd(due) : asOfYmd;
      let delayDays = 0;

      if (due) {
        const diffMs = collectedDate.getTime() - due.getTime();
        delayDays = Math.round(diffMs / 86400000);
        delayDaysSamples.push(delayDays);
      }

      paymentHistory.push({
        tripId: trip.id,
        maneuverCode: trip.maneuverCode,
        dueYmd,
        dueLabel: dateLabel(dueYmd),
        collectedYmd,
        collectedLabel: dateLabelFromIso(iso),
        amount: tripRevenue(trip),
        delayDays,
      });
    } else if (due) {
      const diffMs = asOf.getTime() - due.getTime();
      const overdueDays = Math.round(diffMs / 86400000);
      if (overdueDays > 0) {
        delayDaysSamples.push(overdueDays);
      }
    }
  }
  paymentHistory.sort((a, b) => b.collectedYmd.localeCompare(a.collectedYmd));

  const avgDelayDays =
    delayDaysSamples.length > 0
      ? Math.round(
          (delayDaysSamples.reduce((s, d) => s + d, 0) / delayDaysSamples.length) * 10,
        ) / 10
      : null;

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
    avgDelayDays,
    ...computeVolumeSummary(subset, billable),
  };
}

function computeVolumeSummary(
  allForClient: readonly ClientBalanceTripRow[],
  billable: readonly ClientBalanceTripRow[],
): {
  volumeMonthsWindow: number;
  volumeBillableCount: number;
  volumeAllCount: number;
  volumeManeuversPerMonth: number;
  volumeBilledPerMonth: number;
  volumeOperationalPerMonth: number;
  volumeProfitPerMonth: number;
} {
  const volumeAllCount = allForClient.length;
  const volumeBillableCount = billable.length;

  if (volumeBillableCount === 0) {
    return {
      volumeMonthsWindow: 0,
      volumeBillableCount,
      volumeAllCount,
      volumeManeuversPerMonth: 0,
      volumeBilledPerMonth: 0,
      volumeOperationalPerMonth: 0,
      volumeProfitPerMonth: 0,
    };
  }

  let billedTotal = 0;
  let opsTotal = 0;
  const dates: Date[] = [];

  for (const trip of billable) {
    billedTotal += tripRevenue(trip);
    opsTotal +=
      parseMoney(trip.dieselAmount) +
      parseMoney(trip.casetasAmount) +
      parseMoney(trip.operatorQuota) +
      parseMoney(trip.perDiemAmount);
    const iso = (trip.createdAt ?? '').trim();
    if (iso) {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) dates.push(d);
    }
  }

  if (dates.length === 0) {
    return {
      volumeMonthsWindow: 0,
      volumeBillableCount,
      volumeAllCount,
      volumeManeuversPerMonth: 0,
      volumeBilledPerMonth: 0,
      volumeOperationalPerMonth: 0,
      volumeProfitPerMonth: 0,
    };
  }

  const minT = Math.min(...dates.map((d) => d.getTime()));
  const maxT = Math.max(...dates.map((d) => d.getTime()));
  const lo = new Date(minT);
  const hi = new Date(maxT);
  const volumeMonthsWindow = Math.max(
    1,
    (hi.getUTCFullYear() - lo.getUTCFullYear()) * 12 +
      (hi.getUTCMonth() - lo.getUTCMonth()) +
      1,
  );

  const volumeManeuversPerMonth = volumeBillableCount / volumeMonthsWindow;
  const volumeBilledPerMonth = billedTotal / volumeMonthsWindow;
  const volumeOperationalPerMonth = opsTotal / volumeMonthsWindow;
  const volumeProfitPerMonth = volumeBilledPerMonth - volumeOperationalPerMonth;

  return {
    volumeMonthsWindow,
    volumeBillableCount,
    volumeAllCount,
    volumeManeuversPerMonth: Math.round(volumeManeuversPerMonth * 10) / 10,
    volumeBilledPerMonth: Math.round(volumeBilledPerMonth),
    volumeOperationalPerMonth: Math.round(volumeOperationalPerMonth),
    volumeProfitPerMonth: Math.round(volumeProfitPerMonth),
  };
}

export function buildClientBalancePeriodSummary(
  clientId: string,
  trips: readonly ClientBalanceTripRow[],
  expenses: readonly ClientBalanceExpenseRow[],
  from: string,
  to: string,
  asOf: Date = new Date(),
): ClientBalancePeriodSummaryDto {
  const asOfYmd = operationalYmd(asOf);
  const allForClient = trips.filter((t) => tripMatchesClient(t, clientId));

  const inPeriod = allForClient.filter((t) => {
    const iso = (t.createdAt ?? '').trim();
    if (!iso) return false;
    const ymd = operationalYmd(new Date(iso));
    return ymd >= from && ymd <= to;
  });

  const billable = inPeriod.filter((t) => isTripBillableForReporting(t));
  const completed = inPeriod.filter((t) => t.status === 'completed');

  const collectedInPeriod = allForClient.filter((t) => {
    if (!isTripClientCollected(t)) return false;
    const iso = (t.clientCollectedAt ?? '').trim();
    if (!iso) return false;
    const ymd = operationalYmd(new Date(iso));
    return ymd >= from && ymd <= to;
  });

  const paymentHistory: ClientPaymentHistoryRowDto[] = collectedInPeriod.map((t) => {
    const collectedYmd = operationalYmd(new Date(t.clientCollectedAt!));
    const due = tripDueDate(t);
    const dueYmd = due ? operationalYmd(due) : collectedYmd;
    const collectedDate = new Date(`${collectedYmd}T12:00:00`);
    const dueDate = new Date(`${dueYmd}T12:00:00`);
    const diffMs = collectedDate.getTime() - dueDate.getTime();
    const delayDays = Math.round(diffMs / 86_400_000);
    return {
      tripId: t.id,
      maneuverCode: t.maneuverCode,
      dueYmd,
      dueLabel: dateLabel(dueYmd),
      collectedYmd,
      collectedLabel: dateLabelFromIso(t.clientCollectedAt!),
      amount: tripRevenue(t),
      delayDays,
    };
  });
  paymentHistory.sort((a, b) => b.collectedYmd.localeCompare(a.collectedYmd));

  return {
    from,
    to,
    paymentHistory,
    statusCounts: countByStatus(inPeriod),
    completedCount: completed.length,
    totalKm: Math.round(
      completed.reduce((sum, t) => sum + tripKm(t), 0),
    ),
    ...computeVolumeSummary(inPeriod, billable),
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
