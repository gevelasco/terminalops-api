import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Company } from 'src/companies/entities/company.entity';
import {
  operationalDateKey,
  sqlIsOperationalCalendarToday,
  sqlOperationalCalendarWeekRange,
} from 'src/common/utils/operational-day.util';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { FuelPriceService } from 'src/fuel/fuel-price.service';
import { TripLifecycleService } from 'src/trips/lifecycle/trip-lifecycle.service';
import { buildExpensesByRubroFromKindRows } from 'src/reports/reports-expense-rubro.util';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import type { DashboardInsightsDto } from './dto/dashboard-insights.dto';
import type { DashboardSummaryDto } from './dto/dashboard-summary.dto';

function parseMoneySum(raw: string | null | undefined): number {
  if (raw == null || !String(raw).trim()) {
    return 0;
  }
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function weekOverWeekPercent(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const OPERATIONAL_TZ = 'America/Mexico_City';
const DESTINATION_KEY_SQL = `COALESCE(NULLIF(TRIM(trip.destination_postal_code), ''), NULLIF(TRIM(trip.destination_locality), ''), NULLIF(TRIM(trip.destination_city_municipality), ''))`;
const DESTINATION_DISPLAY_LABEL_SQL = `COALESCE(
  NULLIF(TRIM(CONCAT_WS(', ', NULLIF(TRIM(trip.destination_locality), ''), NULLIF(TRIM(trip.destination_city_municipality), ''))), ''),
  NULLIF(TRIM(trip.destination_postal_code), '')
)`;
const DESTINATION_HAS_LABEL_SQL = `(
  NULLIF(TRIM(trip.destination_locality), '') IS NOT NULL
  OR NULLIF(TRIM(trip.destination_city_municipality), '') IS NOT NULL
  OR NULLIF(TRIM(trip.destination_postal_code), '') IS NOT NULL
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
export class DashboardService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(Unit)
    private readonly unitsRepo: Repository<Unit>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(Expense)
    private readonly expensesRepo: Repository<Expense>,
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
    private readonly fuelPriceService: FuelPriceService,
    private readonly tripLifecycle: TripLifecycleService,
  ) {}

  async getSummary(companyId: number): Promise<DashboardSummaryDto> {
    await this.tripLifecycle.ensureCompanyLifecycleFresh(companyId);

    const now = new Date();
    const operationalDate = operationalDateKey(now);
    const todaySql = sqlIsOperationalCalendarToday;
    const destinationKeySql = DESTINATION_KEY_SQL;

    const [
      tripsInTransit,
      inTransitDestinationsRow,
      unitsAvailable,
      equipmentAvailable,
      tripsScheduled,
      tripsScheduledCurrentWeek,
      tripsScheduledPreviousWeek,
      nextScheduledRow,
      revenueSplitRow,
      completedTripsCount,
      expensesRow,
      expensesCount,
      expenseKindRows,
      company,
    ] = await Promise.all([
      this.tripsRepo.count({
        where: { companyId, status: 'in_transit', deletedAt: IsNull() },
      }),
      this.tripsRepo
        .createQueryBuilder('trip')
        .select(`COUNT(DISTINCT ${destinationKeySql})`, 'count')
        .where('trip.companyId = :companyId', { companyId })
        .andWhere('trip.deleted_at IS NULL')
        .andWhere('trip.status = :status', { status: 'in_transit' })
        .getRawOne<{ count: string }>(),
      this.unitsRepo.count({
        where: { companyId, isActive: true, status: 'available' },
      }),
      this.equipmentRepo.count({
        where: { companyId, isActive: true, status: 'available' },
      }),
      this.tripsRepo.count({
        where: { companyId, status: 'scheduled', deletedAt: IsNull() },
      }),
      this.tripsRepo
        .createQueryBuilder('trip')
        .where('trip.companyId = :companyId', { companyId })
        .andWhere('trip.deleted_at IS NULL')
        .andWhere('trip.status != :cancelled', { cancelled: 'cancelled' })
        .andWhere(sqlOperationalCalendarWeekRange('trip.planned_departure_at', 0))
        .getCount(),
      this.tripsRepo
        .createQueryBuilder('trip')
        .where('trip.companyId = :companyId', { companyId })
        .andWhere('trip.deleted_at IS NULL')
        .andWhere('trip.status != :cancelled', { cancelled: 'cancelled' })
        .andWhere(sqlOperationalCalendarWeekRange('trip.planned_departure_at', -1))
        .getCount(),
      this.tripsRepo
        .createQueryBuilder('trip')
        .select('MIN(trip.planned_departure_at)', 'nextAt')
        .where('trip.companyId = :companyId', { companyId })
        .andWhere('trip.deleted_at IS NULL')
        .andWhere('trip.status = :status', { status: 'scheduled' })
        .andWhere('trip.planned_departure_at >= NOW()')
        .getRawOne<{ nextAt: Date | null }>(),
      this.tripsRepo
        .createQueryBuilder('trip')
        .select(
          `COALESCE(SUM(CASE WHEN trip.client_collected_at IS NOT NULL THEN trip.client_charge ELSE 0 END), 0)`,
          'collected',
        )
        .addSelect(
          `COALESCE(SUM(CASE WHEN trip.client_collected_at IS NULL THEN trip.client_charge ELSE 0 END), 0)`,
          'receivable',
        )
        .where('trip.companyId = :companyId', { companyId })
        .andWhere('trip.deleted_at IS NULL')
        .andWhere('trip.status = :status', { status: 'completed' })
        .andWhere('trip.completed_at IS NOT NULL')
        .andWhere(todaySql('trip.completed_at'))
        .getRawOne<{ collected: string; receivable: string }>(),
      this.tripsRepo
        .createQueryBuilder('trip')
        .where('trip.companyId = :companyId', { companyId })
        .andWhere('trip.deleted_at IS NULL')
        .andWhere('trip.status = :status', { status: 'completed' })
        .andWhere('trip.completed_at IS NOT NULL')
        .andWhere(todaySql('trip.completed_at'))
        .getCount(),
      this.expensesRepo
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.amount), 0)', 'sum')
        .where('e.companyId = :companyId', { companyId })
        .andWhere('e.discarded_at IS NULL')
        .andWhere(todaySql('e.incurred_at'))
        .getRawOne<{ sum: string }>(),
      this.expensesRepo
        .createQueryBuilder('e')
        .where('e.companyId = :companyId', { companyId })
        .andWhere('e.discarded_at IS NULL')
        .andWhere(todaySql('e.incurred_at'))
        .getCount(),
      this.queryTodayExpensesByKind(companyId, todaySql),
      this.companiesRepo.findOne({
        where: { id: companyId },
        select: [
          'id',
          'dieselControlEnabled',
          'dieselReferencePricePerLiter',
          'dieselReferencePriceUpdatedAt',
        ],
      }),
    ]);

    const revenue =
      Math.round(
        (parseMoneySum(revenueSplitRow?.collected) +
          parseMoneySum(revenueSplitRow?.receivable)) *
          100,
      ) / 100;
    const collectedRevenue =
      Math.round(parseMoneySum(revenueSplitRow?.collected) * 100) / 100;
    const receivableRevenue =
      Math.round(parseMoneySum(revenueSplitRow?.receivable) * 100) / 100;
    const expenses = parseMoneySum(expensesRow?.sum);
    const expensesByRubro = buildExpensesByRubroFromKindRows(expenseKindRows);

    const diesel = company
      ? await this.fuelPriceService.resolveDieselForCompany(company)
      : {
          enabled: false,
          pricePerLiter: null,
          suggestedPricePerLiter: null,
          source: null,
          updatedAt: null,
        };

    const tripsInTransitDestinations = Number(inTransitDestinationsRow?.count ?? 0) || 0;
    const nextScheduledDepartureAt = nextScheduledRow?.nextAt
      ? new Date(nextScheduledRow.nextAt).toISOString()
      : null;

    return {
      asOf: now.toISOString(),
      operationalDate,
      tripsInTransit,
      tripsInTransitDestinations,
      unitsAvailable,
      equipmentAvailable,
      tripsScheduled,
      tripsScheduledWeekOverWeekPercent: weekOverWeekPercent(
        tripsScheduledCurrentWeek,
        tripsScheduledPreviousWeek,
      ),
      nextScheduledDepartureAt,
      dailyResult: {
        revenue,
        expenses,
        margin: Math.round((revenue - expenses) * 100) / 100,
        completedTripsCount,
        expensesCount,
        periodDistribution: {
          collectedRevenue,
          receivableRevenue,
          expensesByRubro,
        },
      },
      diesel,
    };
  }

  async getInsights(companyId: number): Promise<DashboardInsightsDto> {
    await this.tripLifecycle.ensureCompanyLifecycleFresh(companyId);

    const flowStartSql = `(NOW() AT TIME ZONE '${OPERATIONAL_TZ}')::date - interval '29 days'`;

    const [
      flowRows,
      tripActivityRows,
      destinationRows,
      recentRows,
      operationRows,
    ] = await Promise.all([
      this.tripsRepo.query(
        `
        WITH days AS (
          SELECT generate_series(
            ${flowStartSql},
            (NOW() AT TIME ZONE '${OPERATIONAL_TZ}')::date,
            interval '1 day'
          )::date AS day
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
            AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date >= ${flowStartSql}
          GROUP BY 1
        ),
        expense_sums AS (
          SELECT
            (e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date AS day,
            COALESCE(SUM(e.amount), 0)::float AS total
          FROM ${this.expensesRepo.metadata.schema}.expenses e
          WHERE e.company_id = $1
            AND e.discarded_at IS NULL
            AND (e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date >= ${flowStartSql}
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
            AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date >= ${flowStartSql}
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
        [companyId],
      ),
      this.tripsRepo.query(
        `
        WITH days AS (
          SELECT generate_series(
            ${flowStartSql},
            (NOW() AT TIME ZONE '${OPERATIONAL_TZ}')::date,
            interval '1 day'
          )::date AS day
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
            AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date >= ${flowStartSql}
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
            AND (COALESCE(trip.departure_at, trip.planned_departure_at) AT TIME ZONE '${OPERATIONAL_TZ}')::date >= ${flowStartSql}
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
            AND (trip.planned_departure_at AT TIME ZONE '${OPERATIONAL_TZ}')::date >= ${flowStartSql}
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
        [companyId],
      ),
      this.tripsRepo
        .createQueryBuilder('trip')
        .select(DESTINATION_DISPLAY_LABEL_SQL, 'destination')
        .addSelect('COUNT(*)', 'trip_count')
        .where('trip.companyId = :companyId', { companyId })
        .andWhere('trip.deleted_at IS NULL')
        .andWhere('trip.status != :cancelled', { cancelled: 'cancelled' })
        .andWhere(
          `(trip.created_at AT TIME ZONE '${OPERATIONAL_TZ}')::date >= ${flowStartSql}`,
        )
        .andWhere(DESTINATION_HAS_LABEL_SQL)
        .groupBy('trip.destinationPostalCode')
        .addGroupBy('trip.destinationLocality')
        .addGroupBy('trip.destinationCityMunicipality')
        .orderBy('trip_count', 'DESC')
        .limit(10)
        .getRawMany<{ destination: string; trip_count: string }>(),
      this.tripsRepo
        .createQueryBuilder('trip')
        .leftJoin(Operator, 'operator', 'operator.id = trip.operatorId')
        .select('trip.id', 'id')
        .addSelect('trip.status', 'status')
        .addSelect('trip.falseManeuver', 'falseManeuver')
        .addSelect(
          `COALESCE(NULLIF(TRIM(operator.name), ''), 'Sin operador')`,
          'operatorName',
        )
        .addSelect(
          `COALESCE(
            NULLIF(TRIM(CONCAT_WS(', ', NULLIF(TRIM(trip.destination_locality), ''), NULLIF(TRIM(trip.destination_city_municipality), ''))), ''),
            NULLIF(TRIM(trip.destination_postal_code), ''),
            '—'
          )`,
          'destination',
        )
        .addSelect('trip.clientCharge', 'clientCharge')
        .where('trip.companyId = :companyId', { companyId })
        .andWhere('trip.deleted_at IS NULL')
        .orderBy('COALESCE(trip.plannedDepartureAt, trip.createdAt)', 'DESC')
        .limit(6)
        .getRawMany<{
          id: string;
          status: string;
          falseManeuver: boolean | null;
          operatorName: string;
          destination: string;
          clientCharge: string | null;
        }>(),
      this.tripsRepo
        .createQueryBuilder('trip')
        .leftJoin(
          `${TERMINALOPS_SCHEMA}.company_operation_configurations`,
          'cfg',
          'cfg.id = trip.operation_configuration_id',
        )
        .select('trip.operationType', 'operationType')
        .addSelect('cfg.name', 'nameSnapshot')
        .addSelect('COUNT(*)', 'count')
        .where('trip.companyId = :companyId', { companyId })
        .andWhere('trip.deleted_at IS NULL')
        .andWhere('trip.status != :cancelled', { cancelled: 'cancelled' })
        .andWhere(
          `(trip.created_at AT TIME ZONE '${OPERATIONAL_TZ}')::date >= ${flowStartSql}`,
        )
        .groupBy('trip.operationType')
        .addGroupBy('cfg.name')
        .orderBy('COUNT(*)', 'DESC')
        .getRawMany<{
          operationType: string;
          nameSnapshot: string | null;
          count: string;
        }>(),
    ]);

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

    const topDestinations = destinationRows.map((row) => ({
      destination: String(row.destination),
      tripCount: Number(row.trip_count) || 0,
    }));

    const recentTrips = recentRows.map((row) => ({
      id: Number(row.id) || 0,
      status: String(row.status ?? ''),
      falseManeuver: row.falseManeuver === true,
      operatorName: String(row.operatorName ?? 'Sin operador'),
      destination: String(row.destination ?? ''),
      clientCharge:
        row.clientCharge != null ? String(row.clientCharge) : null,
    }));

    const operationMix = operationRows.map((row) => ({
      operationType: String(row.operationType ?? ''),
      label: operationDisplayLabel(row.nameSnapshot, row.operationType),
      count: Number(row.count) || 0,
    }));

    const operationMixTotal = operationMix.reduce((sum, s) => sum + s.count, 0);

    return {
      operationalFlow,
      tripActivity,
      topDestinations,
      recentTrips,
      operationMix,
      operationMixTotal,
    };
  }

  private queryTodayExpensesByKind(
    companyId: number,
    todaySql: (column: string) => string,
  ): Promise<Array<{ kind: string; has_trip: string; sum: string; count: string }>> {
    return this.expensesRepo
      .createQueryBuilder('e')
      .select('e.kind', 'kind')
      .addSelect('CASE WHEN e.tripId IS NULL THEN 0 ELSE 1 END', 'has_trip')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'sum')
      .addSelect('COUNT(*)', 'count')
      .where('e.companyId = :companyId', { companyId })
      .andWhere('e.discarded_at IS NULL')
      .andWhere("e.kind <> 'operational_control'")
      .andWhere(todaySql('e.incurred_at'))
      .groupBy('e.kind')
      .addGroupBy('CASE WHEN e.tripId IS NULL THEN 0 ELSE 1 END')
      .getRawMany();
  }
}
