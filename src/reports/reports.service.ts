import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Expense } from 'src/expenses/entities/expense.entity';
import { FleetOverviewService } from 'src/fleet/fleet-overview.service';
import { Trip } from 'src/trips/entities/trip.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import type { ReportsGeneralQueryDto } from './dto/reports-general-query.dto';
import type { ReportsGeneralDto } from './dto/reports-general.dto';
import type { ReportsBalanceDto } from './dto/reports-balance.dto';
import type { ReportsManiobrasDto } from './dto/reports-maniobras.dto';
import type { ReportsFleetDto } from './dto/reports-fleet.dto';
import { buildExpensesByRubroFromKindRows } from './reports-expense-rubro.util';
import {
  OPERATIONAL_TZ,
  parseReportsScope,
  previousPeriodRange,
  tripScopeSql,
  weekOverWeekPercent,
  type ReportsScope,
} from './reports-filter.util';
import { computeManiobraDurationDays } from './reports-maniobras-duration.util';
import { containerTypeLabelMx } from './reports-container-type.util';
import {
  buildReportsFleetComplianceUnits,
  buildReportsFleetStatusMix,
  computeAvgDaysWithoutOperation,
} from './reports-fleet.util';
import {
  EQUIPMENT_OPERATIONAL_CODE_SQL,
  normalizeMaintenanceEntryStatus,
  UNIT_OPERATIONAL_CODE_SQL,
} from './reports-fleet-code.util';
import {
  estimateTireWearMxn,
  parseApproxWeightTons,
} from './reports-fleet-tire-wear.util';

function parseMoneySum(raw: string | null | undefined): number {
  if (raw == null || !String(raw).trim()) {
    return 0;
  }
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseOptionalCoord(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') {
    return null;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseTripStatus(
  raw: string | null | undefined,
): 'scheduled' | 'in_transit' | 'completed' | 'cancelled' {
  switch (raw) {
    case 'scheduled':
    case 'in_transit':
    case 'completed':
    case 'cancelled':
      return raw;
    default:
      return 'scheduled';
  }
}

function parseManeuverCodesList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value).trim()).filter(Boolean);
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

const DESTINATION_DISPLAY_LABEL_SQL = `COALESCE(
  NULLIF(TRIM(CONCAT_WS(', ', NULLIF(TRIM(trip.destination_locality), ''), NULLIF(TRIM(trip.destination_city_municipality), ''))), ''),
  NULLIF(TRIM(MAX(trip.destination)), ''),
  NULLIF(TRIM(trip.destination_postal_code), '')
)`;
const DESTINATION_HAS_LABEL_SQL = `(
  NULLIF(TRIM(trip.destination_locality), '') IS NOT NULL
  OR NULLIF(TRIM(trip.destination_city_municipality), '') IS NOT NULL
  OR NULLIF(TRIM(trip.destination), '') IS NOT NULL
  OR NULLIF(TRIM(trip.destination_postal_code), '') IS NOT NULL
)`;

const ROUTE_DESTINATION_LABEL_SQL = `COALESCE(
  NULLIF(TRIM(CONCAT_WS(', ', NULLIF(TRIM(trip.destination_locality), ''), NULLIF(TRIM(trip.destination_city_municipality), ''))), ''),
  NULLIF(TRIM(trip.destination), ''),
  NULLIF(TRIM(trip.destination_postal_code), ''),
  'Sin destino'
)`;

function operationDisplayLabel(
  nameSnapshot: string | null | undefined,
  operationType: string | null | undefined,
): string {
  const snap = nameSnapshot?.trim() ?? '';
  const code = operationType?.trim().toLowerCase() ?? '';
  const snapLower = snap.toLowerCase();
  if (snap) {
    if (code === 'full' || snapLower === 'full' || /\bfull\b/i.test(snap)) {
      return 'Doble articulado';
    }
    return snap;
  }
  if (code === 'full') {
    return 'Doble articulado';
  }
  if (code === 'sencillo') {
    return 'Sencillo';
  }
  return operationType?.trim() || 'Sin tipo';
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(Expense)
    private readonly expensesRepo: Repository<Expense>,
    @InjectRepository(FleetMaintenanceEntry)
    private readonly maintenanceEntriesRepo: Repository<FleetMaintenanceEntry>,
    private readonly fleetOverview: FleetOverviewService,
  ) {}

  async getGeneral(
    companyId: number,
    query: ReportsGeneralQueryDto,
  ): Promise<ReportsGeneralDto> {
    const scope = parseReportsScope(companyId, query);
    const previous = previousPeriodRange(scope.from, scope.to);
    const daysInRange = this.daysInRange(scope.from, scope.to);

    const [
      completedTripsCount,
      completedTripsPriorCount,
      revenueRow,
      expensesRow,
      expensesCount,
      tripsInTransit,
      tripsScheduledInPeriod,
      unitsUsedRow,
      tripActivityRows,
      flowRows,
      destinationRows,
      operationRows,
      revenueSplitRow,
      expenseKindRows,
      operatorRows,
    ] = await Promise.all([
      this.countCompletedTrips(scope),
      this.countCompletedTrips({ ...scope, from: previous.from, to: previous.to }),
      this.sumCompletedRevenue(scope),
      this.sumExpenses(scope),
      this.countExpenses(scope),
      this.tripsRepo.count({
        where: { companyId: scope.companyId, status: 'in_transit' },
      }),
      this.countScheduledInPeriod(scope),
      this.countDistinctUnits(scope),
      this.queryTripActivity(scope),
      this.queryOperationalFlow(scope),
      this.queryTopDestinations(scope),
      this.queryOperationMix(scope),
      this.sumCompletedRevenueSplit(scope),
      this.queryExpensesByKind(scope),
      this.queryTopOperators(scope),
    ]);

    const revenue = Math.round(parseMoneySum(revenueRow?.sum) * 100) / 100;
    const expenses = Math.round(parseMoneySum(expensesRow?.sum) * 100) / 100;
    const margin = Math.round((revenue - expenses) * 100) / 100;
    const avgRevenuePerTrip =
      completedTripsCount > 0
        ? Math.round((revenue / completedTripsCount) * 100) / 100
        : 0;
    const completedTripsDailyAvg =
      daysInRange > 0
        ? Math.round((completedTripsCount / daysInRange) * 10) / 10
        : 0;

    const tripActivity = (tripActivityRows as Array<{
      date: string;
      completed: number;
      in_transit: number;
      scheduled: number;
    }>).map((row) => ({
      date: String(row.date),
      completed: Number(row.completed) || 0,
      inTransit: Number(row.in_transit) || 0,
      scheduled: Number(row.scheduled) || 0,
    }));

    const operationalFlow = (flowRows as Array<{
      date: string;
      trips: number;
      expenses: number;
      revenue: number;
    }>).map((row) => ({
      date: String(row.date),
      trips: Number(row.trips) || 0,
      expenses: Math.round((Number(row.expenses) || 0) * 100) / 100,
      revenue: Math.round((Number(row.revenue) || 0) * 100) / 100,
    }));

    const topDestinations = destinationRows.map((row) => ({
      destination: String(row.destination),
      tripCount: Number(row.trip_count) || 0,
    }));

    const operationMix = operationRows.map((row) => ({
      operationType: String(row.operationType ?? ''),
      label: operationDisplayLabel(row.nameSnapshot, row.operationType),
      count: Number(row.count) || 0,
    }));
    const operationMixTotal = operationMix.reduce((sum, s) => sum + s.count, 0);
    const collectedRevenue =
      Math.round(parseMoneySum(revenueSplitRow?.collected) * 100) / 100;
    const receivableRevenue =
      Math.round(parseMoneySum(revenueSplitRow?.receivable) * 100) / 100;
    const expensesByRubro = buildExpensesByRubroFromKindRows(expenseKindRows);

    return {
      summary: {
        from: scope.from,
        to: scope.to,
        completedTripsCount,
        completedTripsPriorPeriodPercent: weekOverWeekPercent(
          completedTripsCount,
          completedTripsPriorCount,
        ),
        completedTripsDailyAvg,
        revenue,
        avgRevenuePerTrip,
        expenses,
        expensesCount,
        margin,
        tripsInTransit,
        tripsScheduledInPeriod,
        unitsUsed: Number(unitsUsedRow?.count ?? 0) || 0,
      },
      insights: {
        tripActivity,
        operationalFlow,
        topDestinations,
        operationMix,
        operationMixTotal,
        periodDistribution: {
          collectedRevenue,
          receivableRevenue,
          expensesByRubro,
        },
        topOperators: operatorRows.map((row) => ({
          operatorName: String(row.operator_name ?? 'Sin operador'),
          completed: Number(row.completed) || 0,
          operationalKm: Math.round(parseMoneySum(row.km) * 10) / 10,
        })),
      },
    };
  }

  async getBalance(
    companyId: number,
    query: ReportsGeneralQueryDto,
  ): Promise<ReportsBalanceDto> {
    const scope = parseReportsScope(companyId, query);

    const [
      collectedRow,
      receivableRow,
      accruedRow,
      expensesRow,
      expensesCount,
      provisionsRow,
      payableRow,
      creditRows,
      incomeRows,
      marginRows,
      profitabilityRow,
      expenseKindRows,
      tollsSpendRow,
      operatorSpendRow,
    ] = await Promise.all([
      this.sumCollectedInPeriod(scope),
      this.sumReceivableOpen(scope),
      this.sumCompletedRevenue(scope),
      this.sumExpenses(scope),
      this.countExpenses(scope),
      this.sumProvisions(scope),
      this.sumAccountsPayable(scope),
      this.queryCreditByClient(scope),
      this.queryIncomeByClient(scope),
      this.queryMarginByClient(scope),
      this.queryProfitabilityTotals(scope),
      this.queryExpensesByKind(scope),
      this.sumExpenseByKinds(scope, ['tolls']),
      this.sumExpenseByKinds(scope, ['operator_payment', 'operator_commission']),
    ]);

    const collectedInPeriod = Math.round(parseMoneySum(collectedRow?.sum) * 100) / 100;
    const receivableOpen = Math.round(parseMoneySum(receivableRow?.sum) * 100) / 100;
    const accruedRevenue = Math.round(parseMoneySum(accruedRow?.sum) * 100) / 100;
    const expenses = Math.round(parseMoneySum(expensesRow?.sum) * 100) / 100;
    const provisions = Math.round(parseMoneySum(provisionsRow?.sum) * 100) / 100;
    const accountsPayable = Math.round(parseMoneySum(payableRow?.sum) * 100) / 100;
    const realExpenses = Math.round(Math.max(expenses - provisions, 0) * 100) / 100;
    const cashMargin = Math.round((collectedInPeriod - expenses) * 100) / 100;
    const accruedMargin = Math.round((accruedRevenue - expenses) * 100) / 100;
    const marginPercent =
      accruedRevenue > 0
        ? Math.round((accruedMargin / accruedRevenue) * 1000) / 10
        : null;

    const expensesByRubro = buildExpensesByRubroFromKindRows(expenseKindRows);

    const composition = [
      { key: 'collected', label: 'Ingreso cobrado', amount: collectedInPeriod },
      { key: 'expenses', label: 'Gastos', amount: realExpenses },
      { key: 'receivable', label: 'Por cobrar', amount: receivableOpen },
      { key: 'provisions', label: 'Provisiones', amount: provisions },
    ].filter((slice) => slice.amount > 0);

    const creditByClient = creditRows.map((row) => ({
      clientName: String(row.client_name ?? 'Sin cliente'),
      amount: Math.round(parseMoneySum(row.amount) * 100) / 100,
      nextDueDate: row.next_due ? String(row.next_due) : null,
    }));

    const incomeByClient = incomeRows.map((row) => ({
      clientName: String(row.client_name ?? 'Sin cliente'),
      amount: Math.round(parseMoneySum(row.amount) * 100) / 100,
      tripCount: Number(row.trip_count) || 0,
    }));

    const marginByClient = marginRows.map((row) => {
      const revenue = Math.round(parseMoneySum(row.revenue) * 100) / 100;
      const cost = Math.round(parseMoneySum(row.cost) * 100) / 100;
      const margin = Math.round((revenue - cost) * 100) / 100;
      return {
        clientName: String(row.client_name ?? 'Sin cliente'),
        revenue,
        cost,
        margin,
        marginPercent:
          revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : null,
        tripCount: Number(row.trip_count) || 0,
      };
    });

    const profitabilityRevenue =
      Math.round(parseMoneySum(profitabilityRow?.revenue) * 100) / 100;
    const profitabilityDirectCost =
      Math.round(parseMoneySum(profitabilityRow?.direct_cost) * 100) / 100;
    const profitabilityTripExpenses =
      Math.round(parseMoneySum(profitabilityRow?.trip_expenses) * 100) / 100;
    const profitabilityTotalCost =
      Math.round((profitabilityDirectCost + profitabilityTripExpenses) * 100) / 100;
    const profitabilityMargin =
      Math.round((profitabilityRevenue - profitabilityTotalCost) * 100) / 100;
    const profitabilityMarginPercent =
      profitabilityRevenue > 0
        ? Math.round((profitabilityMargin / profitabilityRevenue) * 1000) / 10
        : null;

    return {
      summary: {
        from: scope.from,
        to: scope.to,
        collectedInPeriod,
        receivableOpen,
        accruedRevenue,
        expenses,
        expensesCount,
        realExpenses,
        provisions,
        accountsPayable,
        cashMargin,
        accruedMargin,
        marginPercent:
          profitabilityMarginPercent ?? marginPercent,
        tollsSpendInPeriod:
          Math.round(parseMoneySum(tollsSpendRow?.sum) * 100) / 100,
        operatorSpendInPeriod:
          Math.round(parseMoneySum(operatorSpendRow?.sum) * 100) / 100,
      },
      insights: {
        composition,
        creditByClient,
        incomeByClient,
        marginByClient,
        profitability: {
          revenue: profitabilityRevenue,
          directCost: profitabilityDirectCost,
          tripExpenses: profitabilityTripExpenses,
          totalCost: profitabilityTotalCost,
          margin: profitabilityMargin,
          marginPercent: profitabilityMarginPercent,
        },
        expensesByRubro,
      },
    };
  }

  async getManiobras(
    companyId: number,
    query: ReportsGeneralQueryDto,
  ): Promise<ReportsManiobrasDto> {
    const scope = parseReportsScope(companyId, query);
    const previous = previousPeriodRange(scope.from, scope.to);

    const [
      completedTripsCount,
      completedTripsPriorCount,
      tripsInTransit,
      tripsScheduledInPeriod,
      cancelledTripsCount,
      delayedTripsCount,
      totalKmRow,
      uniqueDestinationsRow,
      avgDurationRow,
      containerTypeRows,
      cargoWeightRows,
      recurringIncidentRows,
      operatorRows,
      clientRows,
      destinationRows,
      geoRows,
    ] = await Promise.all([
      this.countCompletedTrips(scope),
      this.countCompletedTrips({ ...scope, from: previous.from, to: previous.to }),
      this.tripsRepo.count({
        where: { companyId: scope.companyId, status: 'in_transit' },
      }),
      this.countScheduledInPeriod(scope),
      this.countCancelledInPeriod(scope),
      this.countDelayedTripsInPeriod(scope),
      this.sumOperationalKm(scope),
      this.countUniqueDestinations(scope),
      this.queryAvgManeuverDurationDays(scope),
      this.queryContainerTypeMix(scope),
      this.queryCargoWeightByContainer(scope),
      this.queryRecurringIncidentRoutes(scope),
      this.queryTopOperators(scope),
      this.queryTopClients(scope),
      this.queryTopDestinations(scope),
      this.queryGeoMapTrips(scope),
    ]);

    const totalOperationalKm =
      Math.round(parseMoneySum(totalKmRow?.sum) * 10) / 10;
    const avgKmPerTrip =
      completedTripsCount > 0
        ? Math.round((totalOperationalKm / completedTripsCount) * 10) / 10
        : 0;

    const recurringIncidentRoutes = (
      recurringIncidentRows as Array<{
        destination: string;
        incident_count: string;
        maneuver_codes: string;
        last_incident_at: Date | string | null;
      }>
    ).map((row) => ({
      destination: String(row.destination ?? 'Sin destino'),
      incidentCount: Number(row.incident_count) || 0,
      maneuverCodes: parseManeuverCodesList(row.maneuver_codes),
      lastIncidentAt: row.last_incident_at
        ? new Date(row.last_incident_at).toISOString()
        : null,
    }));

    return {
      summary: {
        from: scope.from,
        to: scope.to,
        completedTripsCount,
        completedTripsPriorPeriodPercent: weekOverWeekPercent(
          completedTripsCount,
          completedTripsPriorCount,
        ),
        tripsInTransit,
        tripsScheduledInPeriod,
        cancelledTripsCount,
        delayedTripsCount,
        totalOperationalKm,
        avgKmPerTrip,
        avgManeuverDurationDays:
          Math.round(parseMoneySum(avgDurationRow?.avg_days) * 10) / 10,
        uniqueDestinations: Number(uniqueDestinationsRow?.count ?? 0) || 0,
      },
      insights: {
        recurringIncidentRoutes,
        topOperators: operatorRows.map((row) => ({
          operatorName: String(row.operator_name ?? 'Sin operador'),
          completed: Number(row.completed) || 0,
          operationalKm: Math.round(parseMoneySum(row.km) * 10) / 10,
        })),
        topClients: clientRows.map((row) => ({
          clientName: String(row.client_name ?? 'Sin cliente'),
          tripCount: Number(row.trip_count) || 0,
        })),
        topDestinations: destinationRows.map((row) => ({
          destination: String(row.destination),
          tripCount: Number(row.trip_count) || 0,
        })),
        containerTypeMix: containerTypeRows.map((row) => ({
          containerType: String(row.container_type ?? 'na'),
          label: containerTypeLabelMx(String(row.container_type ?? '')),
          tripCount: Number(row.trip_count) || 0,
        })),
        cargoWeightByContainer: cargoWeightRows.map((row) => ({
          containerType: String(row.container_type ?? 'na'),
          label: containerTypeLabelMx(String(row.container_type ?? '')),
          tripCount: Number(row.trip_count) || 0,
          avgWeightTons:
            Math.round(parseMoneySum(row.avg_weight_tons) * 100) / 100,
        })),
        geoMapTrips: geoRows
          .map((row) => {
            const lat = parseOptionalCoord(row.lat);
            const lng = parseOptionalCoord(row.lng);
            return {
              tripId: Number(row.trip_id) || 0,
              maneuverCode: String(row.maneuver_code ?? ''),
              status: parseTripStatus(String(row.status ?? '')),
              operatorName: String(row.operator_name ?? 'Sin operador'),
              clientName: String(row.client_name ?? 'Sin cliente'),
              durationDays: computeManiobraDurationDays({
                status: String(row.status ?? ''),
                departureAt: row.departure_at,
                arrivedAt: row.arrived_at,
                plannedDepartureAt: row.planned_departure_at,
                plannedArrivalAt: row.planned_arrival_at,
              }),
              lat,
              lng,
            };
          })
          .filter((trip) => trip.tripId > 0),
      },
    };
  }

  private tripPeriodCreatedSql(alias = 'trip'): string {
    return `${alias}.status != 'cancelled'
      AND (${alias}.created_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date`;
  }

  private countCancelledInPeriod(scope: ReportsScope): Promise<number> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .where('trip.status = :status', { status: 'cancelled' })
      .andWhere(
        `(trip.created_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return this.applyTripScope(qb, scope).getCount();
  }

  private countDelayedTripsInPeriod(scope: ReportsScope): Promise<number> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .where('trip.isDelayed = true')
      .andWhere('trip.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere(
        `(COALESCE(trip.completed_at, trip.planned_departure_at, trip.created_at) AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return this.applyTripScope(qb, scope).getCount();
  }

  private sumOperationalKm(
    scope: ReportsScope,
  ): Promise<{ sum: string } | undefined> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select(
        `COALESCE(SUM(COALESCE(trip.operational_distance_km, trip.route_distance_km, 0)), 0)`,
        'sum',
      )
      .where('trip.status = :status', { status: 'completed' })
      .andWhere('trip.completed_at IS NOT NULL')
      .andWhere(
        `(trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return this.applyTripScope(qb, scope).getRawOne<{ sum: string }>();
  }

  private countDistinctOperators(
    scope: ReportsScope,
  ): Promise<{ count: string } | undefined> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select('COUNT(DISTINCT trip.operator_id)', 'count')
      .where('trip.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere('trip.operator_id IS NOT NULL')
      .andWhere(
        `(trip.created_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return this.applyTripScope(qb, scope).getRawOne<{ count: string }>();
  }

  private countUniqueDestinations(
    scope: ReportsScope,
  ): Promise<{ count: string } | undefined> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];

    return this.tripsRepo
      .query(
        `
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT 1
        FROM ${this.tripsRepo.metadata.schema}.trips trip
        WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
          AND trip.status != 'cancelled'
          AND (trip.created_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
          AND ${DESTINATION_HAS_LABEL_SQL.replace(/trip\./g, 'trip.')}
          ${filter.sql}
        GROUP BY trip.destination_postal_code, trip.destination_locality, trip.destination_city_municipality, trip.destination
      ) grouped
      `,
        params,
      )
      .then((rows) => rows[0]);
  }

  private queryRecurringIncidentRoutes(
    scope: ReportsScope,
  ): Promise<
    Array<{
      destination: string;
      incident_count: string;
      maneuver_codes: string;
      last_incident_at: Date | string | null;
    }>
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;

    return this.tripsRepo.query(
      `
      SELECT
        ${ROUTE_DESTINATION_LABEL_SQL} AS destination,
        COUNT(DISTINCT trip.id)::int AS incident_count,
        string_agg(DISTINCT trip.maneuver_code, ', ' ORDER BY trip.maneuver_code) AS maneuver_codes,
        MAX(inc.occurred_at) AS last_incident_at
      FROM ${schema}.trips trip
      INNER JOIN ${schema}.trip_incidents inc ON inc.trip_id = trip.id
        AND inc.is_incident = true
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND trip.status != 'cancelled'
        AND (trip.created_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        AND ${DESTINATION_HAS_LABEL_SQL}
        ${filter.sql}
      GROUP BY
        trip.destination_postal_code,
        trip.destination_locality,
        trip.destination_city_municipality,
        trip.destination
      ORDER BY incident_count DESC, destination ASC
      LIMIT 12
      `,
      params,
    );
  }

  private queryTopOperators(
    scope: ReportsScope,
  ): Promise<Array<{ operator_name: string; completed: string; km: string }>> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];

    return this.tripsRepo.query(
      `
      SELECT
        trip.operator_id,
        COALESCE(
          NULLIF(TRIM(MAX(op.name)), ''),
          NULLIF(TRIM(MAX(trip.operator_name_snapshot)), ''),
          'Sin operador'
        ) AS operator_name,
        COUNT(*)::int AS completed,
        COALESCE(SUM(COALESCE(trip.operational_distance_km, trip.route_distance_km, 0)), 0)::float AS km
      FROM ${this.tripsRepo.metadata.schema}.trips trip
      INNER JOIN ${this.tripsRepo.metadata.schema}.operators op ON op.id = trip.operator_id
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND trip.operator_id IS NOT NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        ${filter.sql}
      GROUP BY trip.operator_id
      HAVING COUNT(*) > 0
      ORDER BY completed DESC, km DESC
      LIMIT 8
      `,
      params,
    );
  }

  private queryTopClients(
    scope: ReportsScope,
  ): Promise<Array<{ client_name: string; trip_count: string }>> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];

    return this.tripsRepo.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(MAX(trip.client_name)), ''), 'Sin cliente') AS client_name,
        COUNT(*)::int AS trip_count
      FROM ${this.tripsRepo.metadata.schema}.trips trip
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND trip.client_id IS NOT NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        ${filter.sql}
      GROUP BY trip.client_id
      HAVING COUNT(*) > 0
      ORDER BY trip_count DESC
      LIMIT 8
      `,
      params,
    );
  }

  private queryGeoMapTrips(
    scope: ReportsScope,
  ): Promise<
    Array<{
      trip_id: string;
      maneuver_code: string;
      operator_name: string;
      client_name: string;
      status: string;
      departure_at: Date | string | null;
      arrived_at: Date | string | null;
      planned_departure_at: Date | string | null;
      planned_arrival_at: Date | string | null;
      lat: string | number | null;
      lng: string | number | null;
    }>
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;

    return this.tripsRepo.query(
      `
      SELECT
        trip.id::int AS trip_id,
        trip.maneuver_code,
        trip.status,
        trip.departure_at,
        trip.arrived_at,
        trip.planned_departure_at,
        trip.planned_arrival_at,
        COALESCE(NULLIF(TRIM(trip.operator_name_snapshot), ''), 'Sin operador') AS operator_name,
        COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente') AS client_name,
        COALESCE(dr.destination_latitude, cd.latitude)::float AS lat,
        COALESCE(dr.destination_longitude, cd.longitude)::float AS lng
      FROM ${schema}.trips trip
      LEFT JOIN ${schema}.destination_rates dr ON dr.id = trip.destination_rate_id
      LEFT JOIN ${schema}.client_delivery cd ON cd.client_id = trip.client_id
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND trip.status != 'cancelled'
        AND (trip.created_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        ${filter.sql}
      ORDER BY trip.created_at DESC
      LIMIT 400
      `,
      params,
    );
  }

  private tripDirectCostSql(alias = 'trip'): string {
    return `(
      COALESCE(${alias}.diesel_amount, 0)::float
      + COALESCE(${alias}.casetas_amount, 0)::float
      + COALESCE(${alias}.operator_quota, 0)::float
      + COALESCE(${alias}.per_diem_amount, 0)::float
    )`;
  }

  /**
   * Costo por maniobra sin duplicar: si hay gastos en ledger para el trip,
   * usa solo el ledger; si no, cae a los montos programados del trip.
   */
  private tripResolvedCostSql(
    tripAlias = 'trip',
    tripExpenseExpr = 'te.trip_expense',
  ): string {
    const directCost = this.tripDirectCostSql(tripAlias);
    return `CASE WHEN COALESCE(${tripExpenseExpr}, 0) > 0 THEN COALESCE(${tripExpenseExpr}, 0)::float ELSE (${directCost}) END`;
  }

  /** Rubro programado vs ledger (diésel, casetas, operador). */
  private tripCategoryCostSql(tripFieldExpr: string, ledgerExpr: string): string {
    return `CASE WHEN COALESCE(${ledgerExpr}, 0) > 0 THEN COALESCE(${ledgerExpr}, 0)::float ELSE COALESCE(${tripFieldExpr}, 0)::float END`;
  }

  private completedBillableTripPeriodSql(alias = 'trip'): string {
    return `${alias}.status = 'completed'
      AND ${alias}.completed_at IS NOT NULL
      AND (${alias}.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
      AND ${this.billableTripCondition(alias)}`;
  }

  private billableTripCondition(alias = 'trip'): string {
    return `(
      (
        ${alias}.status = 'completed'
        AND ${alias}.completed_at IS NOT NULL
      )
      OR (
        ${alias}.status = 'cancelled'
        AND ${alias}.false_maneuver = true
      )
    )
    AND COALESCE(${alias}.has_client_billing, true) = true
    AND COALESCE(${alias}.client_charge, 0) > 0`;
  }

  private sumCollectedInPeriod(
    scope: ReportsScope,
  ): Promise<{ sum: string } | undefined> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select('COALESCE(SUM(trip.client_charge), 0)', 'sum')
      .where(this.billableTripCondition('trip'))
      .andWhere('trip.client_collected_at IS NOT NULL')
      .andWhere(
        `(trip.client_collected_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return this.applyTripScope(qb, scope).getRawOne<{ sum: string }>();
  }

  private sumReceivableOpen(
    scope: ReportsScope,
  ): Promise<{ sum: string } | undefined> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select('COALESCE(SUM(trip.client_charge), 0)', 'sum')
      .where(this.billableTripCondition('trip'))
      .andWhere('trip.client_collected_at IS NULL');
    return this.applyTripScope(qb, scope).getRawOne<{ sum: string }>();
  }

  private sumProvisions(scope: ReportsScope): Promise<{ sum: string } | undefined> {
    return this.expensesRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.companyId = :companyId', { companyId: scope.companyId })
      .andWhere('e.isOperationalProvision = true')
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .getRawOne<{ sum: string }>();
  }

  private sumAccountsPayable(
    scope: ReportsScope,
  ): Promise<{ sum: string } | undefined> {
    return this.expensesRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.companyId = :companyId', { companyId: scope.companyId })
      .andWhere('e.isOperationalProvision = false')
      .andWhere(
        `LOWER(TRIM(COALESCE(e.paymentMethod, ''))) IN ('credit', 'credit_card', 'card')`,
      )
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .getRawOne<{ sum: string }>();
  }

  private queryCreditByClient(
    scope: ReportsScope,
  ): Promise<
    Array<{ client_name: string; amount: string; next_due: string | null }>
  > {
    const filter = tripScopeSql('trip', scope, 2);
    const params = [scope.companyId, ...filter.params];

    return this.tripsRepo.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente') AS client_name,
        COALESCE(SUM(trip.client_charge), 0)::float AS amount,
        MIN(
          CASE
            WHEN trip.completed_at IS NOT NULL THEN
              ((trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date + trip.credit_days)
            ELSE NULL
          END
        )::text AS next_due
      FROM ${this.tripsRepo.metadata.schema}.trips trip
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND ${this.billableTripCondition('trip')}
        AND trip.client_collected_at IS NULL
        ${filter.sql}
      GROUP BY trip.client_id, trip.client_name
      HAVING COALESCE(SUM(trip.client_charge), 0) > 0
      ORDER BY amount DESC
      LIMIT 8
      `,
      params,
    );
  }

  private queryIncomeByClient(
    scope: ReportsScope,
  ): Promise<Array<{ client_name: string; amount: string; trip_count: string }>> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];

    return this.tripsRepo.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente') AS client_name,
        COALESCE(SUM(trip.client_charge), 0)::float AS amount,
        COUNT(*)::int AS trip_count
      FROM ${this.tripsRepo.metadata.schema}.trips trip
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND ${this.billableTripCondition('trip')}
        AND trip.client_collected_at IS NOT NULL
        AND (trip.client_collected_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        ${filter.sql}
      GROUP BY trip.client_id, trip.client_name
      HAVING COALESCE(SUM(trip.client_charge), 0) > 0
      ORDER BY amount DESC
      LIMIT 8
      `,
      params,
    );
  }

  private queryMarginByClient(
    scope: ReportsScope,
  ): Promise<
    Array<{ client_name: string; revenue: string; cost: string; trip_count: string }>
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const resolvedCost = this.tripResolvedCostSql('trip', 'te.trip_expense');

    return this.tripsRepo.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente') AS client_name,
        COALESCE(SUM(trip.client_charge), 0)::float AS revenue,
        COALESCE(SUM(${resolvedCost}), 0)::float AS cost,
        COUNT(*)::int AS trip_count
      FROM ${this.tripsRepo.metadata.schema}.trips trip
      LEFT JOIN (
        SELECT
          e.trip_id,
          COALESCE(SUM(e.amount), 0)::float AS trip_expense
        FROM ${this.expensesRepo.metadata.schema}.expenses e
        WHERE e.company_id = $1
          AND e.trip_id IS NOT NULL
          AND e.discarded_at IS NULL
          AND e.is_operational_provision = false
          AND (e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        GROUP BY e.trip_id
      ) te ON te.trip_id = trip.id
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND ${this.completedBillableTripPeriodSql('trip')}
        ${filter.sql}
      GROUP BY trip.client_id, trip.client_name
      HAVING COALESCE(SUM(trip.client_charge), 0) > 0
      ORDER BY (COALESCE(SUM(trip.client_charge), 0) - COALESCE(SUM(${resolvedCost}), 0)) DESC
      LIMIT 8
      `,
      params,
    );
  }

  private queryProfitabilityTotals(
    scope: ReportsScope,
  ): Promise<
    | {
        revenue: string;
        direct_cost: string;
        trip_expenses: string;
      }
    | undefined
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const directCost = this.tripDirectCostSql('trip');

    return this.tripsRepo
      .query(
        `
      SELECT
        COALESCE(SUM(trip.client_charge), 0)::float AS revenue,
        COALESCE(
          SUM(
            CASE
              WHEN COALESCE(te.trip_expense, 0) > 0 THEN 0
              ELSE ${directCost}
            END
          ),
          0
        )::float AS direct_cost,
        COALESCE(
          SUM(
            CASE
              WHEN COALESCE(te.trip_expense, 0) > 0 THEN COALESCE(te.trip_expense, 0)::float
              ELSE 0
            END
          ),
          0
        )::float AS trip_expenses
      FROM ${this.tripsRepo.metadata.schema}.trips trip
      LEFT JOIN (
        SELECT
          e.trip_id,
          COALESCE(SUM(e.amount), 0)::float AS trip_expense
        FROM ${this.expensesRepo.metadata.schema}.expenses e
        WHERE e.company_id = $1
          AND e.trip_id IS NOT NULL
          AND e.discarded_at IS NULL
          AND e.is_operational_provision = false
          AND (e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        GROUP BY e.trip_id
      ) te ON te.trip_id = trip.id
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND ${this.completedBillableTripPeriodSql('trip')}
        ${filter.sql}
      `,
        params,
      )
      .then((rows) => rows[0]);
  }

  private queryUnitProfitability(
    scope: ReportsScope,
  ): Promise<
    Array<{
      unit_label: string;
      revenue: string;
      diesel: string;
      operator: string;
      tolls: string;
      maintenance: string;
      tires: string;
    }>
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const tripSchema = this.tripsRepo.metadata.schema;
    const expenseSchema = this.expensesRepo.metadata.schema;
    const dieselCost = this.tripCategoryCostSql('ta.trip_diesel', 'te.fuel');
    const operatorCost = this.tripCategoryCostSql('ta.trip_operator', 'te.operator');
    const tollsCost = this.tripCategoryCostSql('ta.trip_tolls', 'te.tolls');

    return this.tripsRepo.query(
      `
      WITH trip_agg AS (
        SELECT
          trip.unit_id,
          COALESCE(SUM(trip.client_charge), 0)::float AS revenue,
          COALESCE(SUM(COALESCE(trip.diesel_amount, 0)), 0)::float AS trip_diesel,
          COALESCE(SUM(COALESCE(trip.casetas_amount, 0)), 0)::float AS trip_tolls,
          COALESCE(SUM(COALESCE(trip.operator_quota, 0)), 0)::float AS trip_operator
        FROM ${tripSchema}.trips trip
        WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
          AND ${this.completedBillableTripPeriodSql('trip')}
          AND trip.unit_id IS NOT NULL
          ${filter.sql}
        GROUP BY trip.unit_id
      ),
      trip_exp AS (
        SELECT
          t.unit_id,
          COALESCE(SUM(CASE WHEN LOWER(TRIM(e.kind)) = 'fuel' THEN e.amount ELSE 0 END), 0)::float AS fuel,
          COALESCE(SUM(CASE WHEN LOWER(TRIM(e.kind)) = 'tolls' THEN e.amount ELSE 0 END), 0)::float AS tolls,
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(TRIM(e.kind)) IN ('operator_payment', 'operator_commission')
                THEN e.amount
                ELSE 0
              END
            ),
            0
          )::float AS operator,
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(TRIM(e.kind)) IN ('maintenance', 'repair') THEN e.amount
                ELSE 0
              END
            ),
            0
          )::float AS maintenance_trip,
          COALESCE(SUM(CASE WHEN LOWER(TRIM(e.kind)) = 'tires' THEN e.amount ELSE 0 END), 0)::float AS tires_trip
        FROM ${expenseSchema}.expenses e
        INNER JOIN ${tripSchema}.trips t ON t.id = e.trip_id
        WHERE e.company_id = $1
          AND e.discarded_at IS NULL
          AND e.is_operational_provision = false
          AND (e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
          AND t.unit_id IS NOT NULL
          AND t.deleted_at IS NULL
        GROUP BY t.unit_id
      ),
      unit_exp AS (
        SELECT
          e.related_unit_id AS unit_id,
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(TRIM(e.kind)) IN ('maintenance', 'repair') THEN e.amount
                ELSE 0
              END
            ),
            0
          )::float AS maintenance_unit,
          COALESCE(SUM(CASE WHEN LOWER(TRIM(e.kind)) = 'tires' THEN e.amount ELSE 0 END), 0)::float AS tires_unit
        FROM ${expenseSchema}.expenses e
        WHERE e.company_id = $1
          AND e.discarded_at IS NULL
          AND e.related_unit_id IS NOT NULL
          AND e.trip_id IS NULL
          AND e.is_operational_provision = false
          AND (e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        GROUP BY e.related_unit_id
      ),
      active_units AS (
        SELECT unit_id FROM trip_agg
        UNION
        SELECT unit_id FROM unit_exp
      )
      SELECT
        ${UNIT_OPERATIONAL_CODE_SQL} AS unit_label,
        COALESCE(ta.revenue, 0)::float AS revenue,
        (${dieselCost})::float AS diesel,
        (${operatorCost})::float AS operator,
        (${tollsCost})::float AS tolls,
        (COALESCE(te.maintenance_trip, 0) + COALESCE(ue.maintenance_unit, 0))::float AS maintenance,
        (COALESCE(te.tires_trip, 0) + COALESCE(ue.tires_unit, 0))::float AS tires
      FROM active_units au
      INNER JOIN ${tripSchema}.units unit ON unit.id = au.unit_id
      LEFT JOIN trip_agg ta ON ta.unit_id = au.unit_id
      LEFT JOIN trip_exp te ON te.unit_id = au.unit_id
      LEFT JOIN unit_exp ue ON ue.unit_id = au.unit_id
      WHERE unit.company_id = $1
      ORDER BY (
        COALESCE(ta.revenue, 0)
        - (${dieselCost})
        - (${operatorCost})
        - (${tollsCost})
        - (COALESCE(te.maintenance_trip, 0) + COALESCE(ue.maintenance_unit, 0))
        - (COALESCE(te.tires_trip, 0) + COALESCE(ue.tires_unit, 0))
      ) DESC,
      COALESCE(ta.revenue, 0) DESC
      LIMIT 8
      `,
      params,
    );
  }

  private queryExpensesByKind(
    scope: ReportsScope,
  ): Promise<Array<{ kind: string; has_trip: string; sum: string; count: string }>> {
    return this.expensesRepo
      .createQueryBuilder('e')
      .select('e.kind', 'kind')
      .addSelect('CASE WHEN e.tripId IS NULL THEN 0 ELSE 1 END', 'has_trip')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'sum')
      .addSelect('COUNT(*)', 'count')
      .where('e.companyId = :companyId', { companyId: scope.companyId })
      .andWhere('e.isOperationalProvision = false')
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .groupBy('e.kind')
      .addGroupBy('CASE WHEN e.tripId IS NULL THEN 0 ELSE 1 END')
      .getRawMany();
  }

  private daysInRange(from: string, to: string): number {
    const fromDate = new Date(`${from}T12:00:00`);
    const toDate = new Date(`${to}T12:00:00`);
    return Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1);
  }

  private applyTripScope(
    qb: SelectQueryBuilder<Trip>,
    scope: ReportsScope,
  ): SelectQueryBuilder<Trip> {
    qb.andWhere('trip.companyId = :companyId', { companyId: scope.companyId });
    if (scope.clientIds.length > 0) {
      qb.andWhere('trip.clientId IN (:...clientIds)', { clientIds: scope.clientIds });
    }
    if (scope.paymentMethods.length > 0) {
      qb.andWhere('trip.paymentMethod IN (:...paymentMethods)', {
        paymentMethods: scope.paymentMethods,
      });
    }
    return qb;
  }

  private countCompletedTrips(scope: ReportsScope): Promise<number> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .where('trip.status = :status', { status: 'completed' })
      .andWhere('trip.completed_at IS NOT NULL')
      .andWhere(
        `(trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return this.applyTripScope(qb, scope).getCount();
  }

  private sumCompletedRevenueSplit(
    scope: ReportsScope,
  ): Promise<{ collected: string; receivable: string } | undefined> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select(
        `COALESCE(SUM(CASE WHEN trip.client_collected_at IS NOT NULL THEN trip.client_charge ELSE 0 END), 0)`,
        'collected',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN trip.client_collected_at IS NULL THEN trip.client_charge ELSE 0 END), 0)`,
        'receivable',
      )
      .where('trip.status = :status', { status: 'completed' })
      .andWhere('trip.completed_at IS NOT NULL')
      .andWhere(
        `(trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return this.applyTripScope(qb, scope).getRawOne<{ collected: string; receivable: string }>();
  }

  private sumCompletedRevenue(
    scope: ReportsScope,
  ): Promise<{ sum: string } | undefined> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select('COALESCE(SUM(trip.client_charge), 0)', 'sum')
      .where('trip.status = :status', { status: 'completed' })
      .andWhere('trip.completed_at IS NOT NULL')
      .andWhere(
        `(trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return this.applyTripScope(qb, scope).getRawOne<{ sum: string }>();
  }

  private sumExpenses(scope: ReportsScope): Promise<{ sum: string } | undefined> {
    return this.expensesRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.companyId = :companyId', { companyId: scope.companyId })
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .getRawOne<{ sum: string }>();
  }

  private countExpenses(scope: ReportsScope): Promise<number> {
    return this.expensesRepo
      .createQueryBuilder('e')
      .where('e.companyId = :companyId', { companyId: scope.companyId })
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .getCount();
  }

  private sumExpenseByKinds(
    scope: ReportsScope,
    kinds: readonly string[],
  ): Promise<{ sum: string } | undefined> {
    if (kinds.length === 0) {
      return Promise.resolve({ sum: '0' });
    }
    return this.expensesRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.companyId = :companyId', { companyId: scope.companyId })
      .andWhere('e.kind IN (:...kinds)', { kinds: [...kinds] })
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .getRawOne<{ sum: string }>();
  }

  private queryAvgManeuverDurationDays(
    scope: ReportsScope,
  ): Promise<{ avg_days: string } | undefined> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;

    return this.tripsRepo
      .query(
        `
      SELECT AVG(
        EXTRACT(EPOCH FROM (
          COALESCE(trip.arrived_at, trip.planned_arrival_at) -
          COALESCE(trip.departure_at, trip.planned_departure_at)
        )) / 86400.0
      )::float AS avg_days
      FROM ${schema}.trips trip
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        AND COALESCE(trip.arrived_at, trip.planned_arrival_at) IS NOT NULL
        AND COALESCE(trip.departure_at, trip.planned_departure_at) IS NOT NULL
        AND COALESCE(trip.arrived_at, trip.planned_arrival_at)
          >= COALESCE(trip.departure_at, trip.planned_departure_at)
        ${filter.sql}
      `,
        params,
      )
      .then((rows) => rows[0]);
  }

  private queryContainerTypeMix(
    scope: ReportsScope,
  ): Promise<Array<{ container_type: string; trip_count: string }>> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;

    return this.tripsRepo.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(trip.container_type), ''), 'na') AS container_type,
        COUNT(*)::int AS trip_count
      FROM ${schema}.trips trip
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        ${filter.sql}
      GROUP BY COALESCE(NULLIF(TRIM(trip.container_type), ''), 'na')
      HAVING COUNT(*) > 0
      ORDER BY trip_count DESC
      `,
      params,
    );
  }

  private queryCargoWeightByContainer(
    scope: ReportsScope,
  ): Promise<
    Array<{ container_type: string; trip_count: string; avg_weight_tons: string }>
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;

    return this.tripsRepo.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(trip.container_type), ''), 'na') AS container_type,
        COUNT(*)::int AS trip_count,
        AVG(trip.approximate_weight_tons::float)::float AS avg_weight_tons
      FROM ${schema}.trips trip
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        AND trip.approximate_weight_tons IS NOT NULL
        AND trip.approximate_weight_tons::float > 0
        ${filter.sql}
      GROUP BY COALESCE(NULLIF(TRIM(trip.container_type), ''), 'na')
      HAVING COUNT(*) > 0
      ORDER BY avg_weight_tons DESC
      `,
      params,
    );
  }

  private countScheduledInPeriod(scope: ReportsScope): Promise<number> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .where('trip.status = :status', { status: 'scheduled' })
      .andWhere('trip.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere(
        `(trip.planned_departure_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return this.applyTripScope(qb, scope).getCount();
  }

  private countDistinctUnits(
    scope: ReportsScope,
  ): Promise<{ count: string } | undefined> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select('COUNT(DISTINCT trip.unit_id)', 'count')
      .where('trip.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere('trip.unit_id IS NOT NULL')
      .andWhere(
        `(COALESCE(trip.completed_at, trip.planned_departure_at, trip.created_at) AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return this.applyTripScope(qb, scope).getRawOne<{ count: string }>();
  }

  private queryTripActivity(scope: ReportsScope): Promise<unknown[]> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];

    return this.tripsRepo.query(
      `
      WITH days AS (
        SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
      ),
      completed_counts AS (
        SELECT
          (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date AS day,
          COUNT(*)::int AS cnt
        FROM ${this.tripsRepo.metadata.schema}.trips trip
        WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
          AND trip.status = 'completed'
          AND trip.completed_at IS NOT NULL
          AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
          ${filter.sql}
        GROUP BY 1
      ),
      in_transit_counts AS (
        SELECT
          (COALESCE(trip.departure_at, trip.planned_departure_at) AT TIME ZONE '${OPERATIONAL_TZ}')::date AS day,
          COUNT(*)::int AS cnt
        FROM ${this.tripsRepo.metadata.schema}.trips trip
        WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
          AND trip.status = 'in_transit'
          AND (COALESCE(trip.departure_at, trip.planned_departure_at) AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
          ${filter.sql}
        GROUP BY 1
      ),
      scheduled_counts AS (
        SELECT
          (trip.planned_departure_at AT TIME ZONE '${OPERATIONAL_TZ}')::date AS day,
          COUNT(*)::int AS cnt
        FROM ${this.tripsRepo.metadata.schema}.trips trip
        WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
          AND trip.status = 'scheduled'
          AND (trip.planned_departure_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
          ${filter.sql}
        GROUP BY 1
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS date,
        COALESCE(cc.cnt, 0)::int AS completed,
        COALESCE(it.cnt, 0)::int AS in_transit,
        COALESCE(sc.cnt, 0)::int AS scheduled
      FROM days d
      LEFT JOIN completed_counts cc ON cc.day = d.day
      LEFT JOIN in_transit_counts it ON it.day = d.day
      LEFT JOIN scheduled_counts sc ON sc.day = d.day
      ORDER BY d.day ASC
      `,
      params,
    );
  }

  private queryOperationalFlow(scope: ReportsScope): Promise<unknown[]> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];

    return this.tripsRepo.query(
      `
      WITH days AS (
        SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
      ),
      trip_counts AS (
        SELECT
          (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date AS day,
          COUNT(*)::int AS cnt
        FROM ${this.tripsRepo.metadata.schema}.trips trip
        WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
          AND trip.status = 'completed'
          AND trip.completed_at IS NOT NULL
          AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
          ${filter.sql}
        GROUP BY 1
      ),
      expense_sums AS (
        SELECT
          (e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date AS day,
          COALESCE(SUM(e.amount), 0)::float AS total
        FROM ${this.expensesRepo.metadata.schema}.expenses e
        WHERE e.company_id = $1
          AND e.discarded_at IS NULL
          AND (e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        GROUP BY 1
      ),
      revenue_sums AS (
        SELECT
          (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date AS day,
          COALESCE(SUM(trip.client_charge), 0)::float AS total
        FROM ${this.tripsRepo.metadata.schema}.trips trip
        WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
          AND trip.status = 'completed'
          AND trip.completed_at IS NOT NULL
          AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
          ${filter.sql}
        GROUP BY 1
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS date,
        COALESCE(tc.cnt, 0)::int AS trips,
        COALESCE(es.total, 0)::float AS expenses,
        COALESCE(rs.total, 0)::float AS revenue
      FROM days d
      LEFT JOIN trip_counts tc ON tc.day = d.day
      LEFT JOIN expense_sums es ON es.day = d.day
      LEFT JOIN revenue_sums rs ON rs.day = d.day
      ORDER BY d.day ASC
      `,
      params,
    );
  }

  private queryTopDestinations(
    scope: ReportsScope,
  ): Promise<Array<{ destination: string; trip_count: string }>> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select(DESTINATION_DISPLAY_LABEL_SQL, 'destination')
      .addSelect('COUNT(*)', 'trip_count')
      .where('trip.status = :completed', { completed: 'completed' })
      .andWhere('trip.completedAt IS NOT NULL')
      .andWhere(
        `(trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .andWhere(DESTINATION_HAS_LABEL_SQL)
      .groupBy('trip.destinationPostalCode')
      .addGroupBy('trip.destinationLocality')
      .addGroupBy('trip.destinationCityMunicipality')
      .orderBy('trip_count', 'DESC')
      .limit(8);
    return this.applyTripScope(qb, scope).getRawMany();
  }

  private queryOperationMix(
    scope: ReportsScope,
  ): Promise<
    Array<{ operationType: string; nameSnapshot: string | null; count: string }>
  > {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select('trip.operationType', 'operationType')
      .addSelect('trip.operationConfigurationNameSnapshot', 'nameSnapshot')
      .addSelect('COUNT(*)', 'count')
      .where('trip.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere(
        `(trip.created_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .groupBy('trip.operationType')
      .addGroupBy('trip.operationConfigurationNameSnapshot')
      .orderBy('COUNT(*)', 'DESC');
    return this.applyTripScope(qb, scope).getRawMany();
  }

  async getFleet(
    companyId: number,
    query: ReportsGeneralQueryDto,
  ): Promise<ReportsFleetDto> {
    const scope = parseReportsScope(companyId, query);

    const [
      overview,
      totalKmRow,
      dieselRow,
      topUnitRows,
      maintenanceEventRows,
      maintenanceEventsCount,
      maintenanceSpendRow,
      tireWearRows,
      unitProfitabilityRows,
    ] = await Promise.all([
      this.fleetOverview.listOverview(scope.companyId),
      this.sumOperationalKm(scope),
      this.sumFleetDiesel(scope),
      this.queryTopUnitsByKm(scope),
      this.queryFleetMaintenanceEvents(scope),
      this.countFleetMaintenanceEvents(scope),
      this.sumFleetExpenseKind(scope, ['maintenance', 'repair', 'tires']),
      this.queryTireWearByUnit(scope),
      this.queryUnitProfitability(scope),
    ]);

    const statusMix = buildReportsFleetStatusMix(overview.items);
    const complianceUnits = buildReportsFleetComplianceUnits(overview.items);

    const avgDaysWithoutOperation = computeAvgDaysWithoutOperation(overview.items);

    const totalOperationalKm =
      Math.round(parseMoneySum(totalKmRow?.sum) * 10) / 10;
    const totalDieselLiters =
      Math.round(parseMoneySum(dieselRow?.liters) * 10) / 10;
    const totalDieselAmount = Math.round(parseMoneySum(dieselRow?.amount) * 100) / 100;
    const maintenanceSpendInPeriod = Math.round(
      parseMoneySum(maintenanceSpendRow?.sum) * 100,
    ) / 100;

    return {
      summary: {
        from: scope.from,
        to: scope.to,
        totalOperationalKm,
        totalDieselLiters,
        totalDieselAmount,
        maintenanceEventsInPeriod: maintenanceEventsCount,
        maintenanceSpendInPeriod,
        avgDaysWithoutOperation,
      },
      insights: {
        statusMix,
        topUnitsByKm: topUnitRows.map((row) => ({
          unitLabel: String(row.unit_label ?? 'Sin unidad'),
          completedTrips: Number(row.completed) || 0,
          operationalKm: Math.round(parseMoneySum(row.km) * 10) / 10,
          dieselLiters: Math.round(parseMoneySum(row.diesel_liters) * 10) / 10,
        })),
        maintenanceEvents: maintenanceEventRows.map((row) => ({
          assetLabel: String(row.asset_label ?? '—'),
          assetKind: row.equipment_id != null ? 'equipment' : 'unit',
          entryDate: row.entry_date ? String(row.entry_date) : null,
          entryType: String(row.entry_type ?? '—'),
          status: normalizeMaintenanceEntryStatus(row.status),
          cost: Math.round(parseMoneySum(row.cost) * 100) / 100,
        })),
        complianceUnits,
        tireWearByUnit: tireWearRows.map((row) => {
          const operationalKm = Math.round(parseMoneySum(row.operational_km) * 10) / 10;
          const avgWeightTons = Math.round(parseApproxWeightTons(row.avg_weight_tons) * 10) / 10;
          const wear = estimateTireWearMxn(operationalKm, avgWeightTons);
          return {
            unitCode: String(row.unit_code ?? '—'),
            tripCount: Number(row.trip_count) || 0,
            operationalKm,
            avgWeightTons,
            tireWearMxn: wear.tireWearMxn,
            tireCpkMxn: wear.tireCpkMxn,
            tireLifeUsedPercent: wear.tireLifeUsedPercent,
          };
        }),
        unitProfitability: this.mapUnitProfitabilityRows(unitProfitabilityRows),
      },
    };
  }

  private mapUnitProfitabilityRows(
    rows: Array<{
      unit_label: string;
      revenue: string;
      diesel: string;
      operator: string;
      tolls: string;
      maintenance: string;
      tires: string;
    }>,
  ) {
    return rows.map((row) => {
      const revenue = Math.round(parseMoneySum(row.revenue) * 100) / 100;
      const diesel = Math.round(parseMoneySum(row.diesel) * 100) / 100;
      const operator = Math.round(parseMoneySum(row.operator) * 100) / 100;
      const tolls = Math.round(parseMoneySum(row.tolls) * 100) / 100;
      const maintenance = Math.round(parseMoneySum(row.maintenance) * 100) / 100;
      const tires = Math.round(parseMoneySum(row.tires) * 100) / 100;
      const netMargin = Math.round((revenue - diesel - operator - tolls - maintenance - tires) * 100) / 100;
      return {
        unitLabel: String(row.unit_label ?? '—'),
        revenue,
        diesel,
        operator,
        tolls,
        maintenance,
        tires,
        netMargin,
        marginPercent:
          revenue > 0 ? Math.round((netMargin / revenue) * 1000) / 10 : null,
      };
    });
  }

  private sumFleetDiesel(
    scope: ReportsScope,
  ): Promise<{ liters: string; amount: string } | undefined> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select('COALESCE(SUM(COALESCE(trip.diesel_liters, 0)), 0)', 'liters')
      .addSelect('COALESCE(SUM(COALESCE(trip.diesel_amount, 0)), 0)', 'amount')
      .where('trip.status = :status', { status: 'completed' })
      .andWhere('trip.completed_at IS NOT NULL')
      .andWhere(
        `(trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return this.applyTripScope(qb, scope).getRawOne<{ liters: string; amount: string }>();
  }

  private queryTopUnitsByKm(
    scope: ReportsScope,
  ): Promise<
    Array<{
      unit_label: string;
      completed: string;
      km: string;
      diesel_liters: string;
    }>
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;

    return this.tripsRepo.query(
      `
      SELECT
        ${UNIT_OPERATIONAL_CODE_SQL} AS unit_label,
        COUNT(*)::int AS completed,
        COALESCE(SUM(COALESCE(trip.operational_distance_km, trip.route_distance_km, 0)), 0)::float AS km,
        COALESCE(SUM(COALESCE(trip.diesel_liters, 0)), 0)::float AS diesel_liters
      FROM ${schema}.trips trip
      INNER JOIN ${schema}.units unit ON unit.id = trip.unit_id
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND trip.unit_id IS NOT NULL
        AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        ${filter.sql}
      GROUP BY trip.unit_id, unit.id, unit.trailer_brand_abbr, unit.trailer_year, unit.plate
      HAVING COUNT(*) > 0
      ORDER BY km DESC, completed DESC
      LIMIT 8
      `,
      params,
    );
  }

  private countFleetMaintenanceEvents(scope: ReportsScope): Promise<number> {
    const schema = this.maintenanceEntriesRepo.metadata.schema;
    return this.maintenanceEntriesRepo
      .query(
        `
        SELECT COUNT(*)::int AS count
        FROM ${schema}.fleet_maintenance_entries me
        LEFT JOIN ${schema}.units u ON u.id = me.unit_id
        LEFT JOIN ${schema}.equipment e ON e.id = me.equipment_id
        WHERE COALESCE(u.company_id, e.company_id) = $1
          AND me.entry_date IS NOT NULL
          AND me.entry_date BETWEEN $2::date AND $3::date
        `,
        [scope.companyId, scope.from, scope.to],
      )
      .then((rows) => Number(rows[0]?.count ?? 0) || 0);
  }

  private queryFleetMaintenanceEvents(
    scope: ReportsScope,
  ): Promise<
    Array<{
      asset_label: string;
      unit_id: number | null;
      equipment_id: number | null;
      entry_date: string | null;
      entry_type: string | null;
      status: string | null;
      cost: string | null;
    }>
  > {
    const schema = this.maintenanceEntriesRepo.metadata.schema;
    return this.maintenanceEntriesRepo.query(
      `
      SELECT
        COALESCE(
          CASE WHEN me.unit_id IS NOT NULL THEN ${UNIT_OPERATIONAL_CODE_SQL} END,
          CASE WHEN me.equipment_id IS NOT NULL THEN ${EQUIPMENT_OPERATIONAL_CODE_SQL} END,
          '—'
        ) AS asset_label,
        me.unit_id,
        me.equipment_id,
        me.entry_date::text AS entry_date,
        me.entry_type,
        me.status,
        me.cost
      FROM ${schema}.fleet_maintenance_entries me
      LEFT JOIN ${schema}.units unit ON unit.id = me.unit_id
      LEFT JOIN ${schema}.equipment e ON e.id = me.equipment_id
      WHERE COALESCE(unit.company_id, e.company_id) = $1
        AND me.entry_date IS NOT NULL
        AND me.entry_date BETWEEN $2::date AND $3::date
      ORDER BY me.entry_date DESC, me.id DESC
      LIMIT 12
      `,
      [scope.companyId, scope.from, scope.to],
    );
  }

  private queryTireWearByUnit(
    scope: ReportsScope,
  ): Promise<
    Array<{
      unit_code: string;
      trip_count: string;
      operational_km: string;
      avg_weight_tons: string | null;
    }>
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;

    return this.tripsRepo.query(
      `
      SELECT
        ${UNIT_OPERATIONAL_CODE_SQL} AS unit_code,
        COUNT(*)::int AS trip_count,
        COALESCE(SUM(COALESCE(trip.operational_distance_km, trip.route_distance_km, 0)), 0)::float AS operational_km,
        AVG(
          CASE
            WHEN trip.approximate_weight_tons IS NOT NULL
              AND trip.approximate_weight_tons::float > 0
            THEN trip.approximate_weight_tons::float
            ELSE NULL
          END
        )::float AS avg_weight_tons
      FROM ${schema}.trips trip
      INNER JOIN ${schema}.units unit ON unit.id = trip.unit_id
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND trip.unit_id IS NOT NULL
        AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        ${filter.sql}
      GROUP BY trip.unit_id, unit.id, unit.trailer_brand_abbr, unit.trailer_year, unit.plate
      HAVING COUNT(*) > 0
      ORDER BY operational_km DESC, trip_count DESC
      LIMIT 12
      `,
      params,
    );
  }

  private sumFleetExpenseKind(
    scope: ReportsScope,
    kinds: readonly string[],
  ): Promise<{ sum: string } | undefined> {
    if (kinds.length === 0) {
      return Promise.resolve({ sum: '0' });
    }
    const qb = this.expensesRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.companyId = :companyId', { companyId: scope.companyId })
      .andWhere('e.kind IN (:...kinds)', { kinds: [...kinds] })
      .andWhere('(e.relatedUnitId IS NOT NULL OR e.relatedEquipmentId IS NOT NULL)')
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return qb.getRawOne<{ sum: string }>();
  }
}
