import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Expense } from 'src/expenses/entities/expense.entity';
import { FleetOverviewService } from 'src/fleet/fleet-overview.service';
import { CompanyOperationConfiguration } from 'src/operation-configurations/entities/company-operation-configuration.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { expenseNotDiscardedSql } from 'src/trips/trip-visibility.util';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import {
  buildPayableItems,
  LEDGER_PAYABLE_KINDS,
} from './reports-payable-items.util';
import type { ReportsGeneralQueryDto } from './dto/reports-general-query.dto';
import type { ReportsBalanceDto } from './dto/reports-balance.dto';
import type { ReportsManiobrasDto } from './dto/reports-maniobras.dto';
import type { ReportsFleetDto } from './dto/reports-fleet.dto';
import { buildExpensesByRubroFromKindRows } from './reports-expense-rubro.util';
import type {
  ReportsBalanceDailyActivityDayDto,
  ReportsBalanceDailyActivityEventDto,
} from './dto/reports-balance.dto';
import {
  OPERATIONAL_TZ,
  applyReportsTripScope,
  parseReportsScope,
  previousPeriodRange,
  tripScopeSql,
  weekOverWeekPercent,
  type ReportsScope,
} from './reports-filter.util';
import { computeManiobraDurationDays } from './reports-maniobras-duration.util';
import { buildManiobraRalentiReport } from './reports-maniobras-ralenti.util';
import { containerTypeLabelMx } from '../trips/trip-container-type.util';
import {
  buildReportsFleetComplianceUnits,
  buildReportsFleetStatusMix,
  computeAvgDaysWithoutOperation,
} from './reports-fleet.util';
import {
  EQUIPMENT_OPERATIONAL_CODE_SQL,
  UNIT_OPERATIONAL_CODE_SQL,
} from './reports-fleet-code.util';
import {
  estimateTireWearMxn,
  parseApproxWeightTons,
} from './reports-fleet-tire-wear.util';

function parseMoneySum(raw: string | number | null | undefined): number {
  if (raw == null || !String(raw).trim()) {
    return 0;
  }
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseOptionalCoord(
  raw: string | number | null | undefined,
): number | null {
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
  NULLIF(TRIM(trip.destination_postal_code), '')
)`;
const DESTINATION_HAS_LABEL_SQL = `(
  NULLIF(TRIM(trip.destination_locality), '') IS NOT NULL
  OR NULLIF(TRIM(trip.destination_city_municipality), '') IS NOT NULL
  OR NULLIF(TRIM(trip.destination_postal_code), '') IS NOT NULL
)`;

const ROUTE_DESTINATION_LABEL_SQL = `COALESCE(
  NULLIF(TRIM(CONCAT_WS(', ', NULLIF(TRIM(trip.destination_locality), ''), NULLIF(TRIM(trip.destination_city_municipality), ''))), ''),
  NULLIF(TRIM(trip.destination_postal_code), ''),
  'Sin destino'
)`;

/** Evita `invalid input syntax for type double precision: ""` en columnas text/numeric. */
function sqlTripNumeric(column: string): string {
  return `NULLIF(TRIM(${column}::text), '')::double precision`;
}

/** Km operativos = route_distance_km × 2 (ida+vuelta siempre). */
const OPERATIONAL_KM_EXPR = `COALESCE(${sqlTripNumeric('trip.route_distance_km')}, 0) * 2`;

const AVG_APPROX_WEIGHT_TONS_SQL = `AVG(
  CASE
    WHEN ${sqlTripNumeric('trip.approximate_weight_tons')} IS NOT NULL
      AND ${sqlTripNumeric('trip.approximate_weight_tons')} > 0
    THEN ${sqlTripNumeric('trip.approximate_weight_tons')}
    ELSE NULL
  END
)::double precision`;

/**
 * Rango sargable equivalente a
 * `(column AT TIME ZONE tz)::date BETWEEN from AND to` para timestamptz.
 */
function occurredInOperationalPeriod(
  column: string,
  fromParam: string,
  toParam: string,
): string {
  return `${column} >= (${fromParam}::timestamp AT TIME ZONE '${OPERATIONAL_TZ}')
    AND ${column} < ((${toParam}::date + 1)::timestamp AT TIME ZONE '${OPERATIONAL_TZ}')`;
}

const EXPENSE_PAID_GATE_KINDS = new Set([
  'insurance',
  'gps',
  'tenure_payment',
  'operator_payment',
  'operator_commission',
]);

function operationDisplayLabel(
  nameSnapshot: string | null | undefined,
  operationType: string | null | undefined,
): string {
  const snap = nameSnapshot?.trim() ?? '';
  const code = operationType?.trim().toLowerCase() ?? '';
  const snapLower = snap.toLowerCase();
  if (snap) {
    if (
      code === 'full' ||
      code === 'doble-articulado' ||
      snapLower === 'full' ||
      snapLower.includes('doble articulado') ||
      /\bfull\b/i.test(snap)
    ) {
      return 'Doble articulado';
    }
    return snap;
  }
  if (code === 'full' || code === 'doble-articulado') {
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

  async getBalance(
    companyId: number,
    query: ReportsGeneralQueryDto,
  ): Promise<ReportsBalanceDto> {
    const scope = parseReportsScope(companyId, query);

    const [
      tripTotals,
      expenseFacts,
      creditRows,
      incomeRows,
      clientProfitRows,
      incomeEventRows,
      receivableEventRows,
      payableExpenses,
    ] = await Promise.all([
      this.queryBalanceTripTotals(scope),
      this.queryPeriodExpenseFacts(scope),
      this.queryCreditByClient(scope),
      this.queryIncomeByClient(scope),
      this.queryClientProfitability(scope),
      this.queryDailyIncomeEvents(scope),
      this.queryDailyReceivableEvents(scope),
      this.expensesRepo
        .createQueryBuilder('e')
        .select([
          'e.id',
          'e.kind',
          'e.description',
          'e.category',
          'e.amount',
          'e.vendor',
          'e.incurredAt',
          'e.paidAt',
          'e.discardedAt',
        ])
        .where('e.companyId = :companyId', { companyId: scope.companyId })
        .andWhere('e.discarded_at IS NULL')
        .andWhere('e.paid_at IS NULL')
        .andWhere('e.kind IN (:...kinds)', { kinds: [...LEDGER_PAYABLE_KINDS] })
        .andWhere(
          `e.incurred_at < ((:to::date + 1)::timestamp AT TIME ZONE '${OPERATIONAL_TZ}')`,
          { to: scope.to },
        )
        .getMany(),
    ]);

    const collectedInPeriod = tripTotals.collected;
    const receivableOpen = tripTotals.receivable;
    const accruedRevenue = tripTotals.accrued;
    const expenses = expenseFacts.expenses;
    const expensesCount = expenseFacts.expensesCount;
    const provisions = expenseFacts.provisions;
    const expenseEventRows = expenseFacts.expenseEvents;
    const payableEventRows = expenseFacts.payableEvents;
    const expenseKindRows = expenseFacts.kindRows;
    const tollsSpendRow = { sum: String(expenseFacts.tolls) };
    const operatorSpendRow = { sum: String(expenseFacts.operatorSpend) };
    const maintenanceSpendRow = { sum: String(expenseFacts.maintenanceSpend) };
    const marginRows = clientProfitRows.slice(0, 3);
    const profitabilityRow = clientProfitRows.reduce(
      (totals, row) => ({
        revenue: totals.revenue + parseMoneySum(row.revenue),
        direct_cost: totals.direct_cost + parseMoneySum(row.direct_cost),
        trip_expenses: totals.trip_expenses + parseMoneySum(row.trip_expenses),
      }),
      { revenue: 0, direct_cost: 0, trip_expenses: 0 },
    );
    const realExpenses =
      Math.round(Math.max(expenses - provisions, 0) * 100) / 100;
    const cashMargin = Math.round((collectedInPeriod - expenses) * 100) / 100;
    const accruedMargin = Math.round((accruedRevenue - expenses) * 100) / 100;
    const marginPercent =
      accruedRevenue > 0
        ? Math.round((accruedMargin / accruedRevenue) * 1000) / 10
        : null;

    const payableItems = buildPayableItems({
      expenses: payableExpenses,
      to: scope.to,
    });

    const expensesByRubro = buildExpensesByRubroFromKindRows(expenseKindRows);
    const dailyActivity = this.buildDailyActivity(
      incomeEventRows,
      expenseEventRows,
      receivableEventRows,
      payableEventRows,
      scope.from,
      scope.to,
    );

    const composition = [
      { key: 'collected', label: 'Ingreso cobrado', amount: collectedInPeriod },
      { key: 'expenses', label: 'Gastos', amount: realExpenses },
      { key: 'receivable', label: 'Por cobrar', amount: receivableOpen },
      {
        key: 'provisions',
        label: 'Reserva por maniobra',
        amount: provisions,
      },
    ].filter((slice) => slice.amount > 0);

    const creditByClient = creditRows.map((row) => ({
      clientName: String(row.client_name ?? 'Sin cliente'),
      amount: Math.round(parseMoneySum(row.amount) * 100) / 100,
      tripCount: Number(row.trip_count) || 0,
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
      Math.round((profitabilityDirectCost + profitabilityTripExpenses) * 100) /
      100;
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
        cashMargin,
        accruedMargin,
        marginPercent: profitabilityMarginPercent ?? marginPercent,
        tollsSpendInPeriod:
          Math.round(parseMoneySum(tollsSpendRow?.sum) * 100) / 100,
        operatorSpendInPeriod:
          Math.round(parseMoneySum(operatorSpendRow?.sum) * 100) / 100,
        maintenanceSpendInPeriod:
          Math.round(parseMoneySum(maintenanceSpendRow?.sum) * 100) / 100,
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
        dailyActivity,
        payableItems,
      },
    };
  }

  /** Cobrado del periodo, cartera abierta y venta completada, en una pasada. */
  private queryBalanceTripTotals(scope: ReportsScope): Promise<{
    collected: number;
    receivable: number;
    accrued: number;
  }> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;
    const collectedPeriod = occurredInOperationalPeriod(
      'trip.client_collected_at',
      '$2',
      '$3',
    );
    const completedPeriod = occurredInOperationalPeriod(
      'trip.completed_at',
      '$2',
      '$3',
    );

    return this.tripsRepo
      .query(
        `
      SELECT
        COALESCE(SUM(trip.client_charge) FILTER (
          WHERE ${this.billableTripCondition('trip')}
            AND trip.client_collected_at IS NOT NULL
            AND ${collectedPeriod}
        ), 0)::float AS collected,
        COALESCE(SUM(trip.client_charge) FILTER (
          WHERE ${this.billableTripCondition('trip')}
            AND trip.client_collected_at IS NULL
        ), 0)::float AS receivable,
        COALESCE(SUM(trip.client_charge) FILTER (
          WHERE trip.status = 'completed'
            AND trip.completed_at IS NOT NULL
            AND ${completedPeriod}
        ), 0)::float AS accrued
      FROM ${schema}.trips trip
      WHERE trip.company_id = $1
        AND trip.deleted_at IS NULL
        ${filter.sql}
      `,
        params,
      )
      .then((rows: Array<{ collected: string; receivable: string; accrued: string }>) => {
        const row = rows[0];
        return {
          collected: Math.round(parseMoneySum(row?.collected) * 100) / 100,
          receivable: Math.round(parseMoneySum(row?.receivable) * 100) / 100,
          accrued: Math.round(parseMoneySum(row?.accrued) * 100) / 100,
        };
      });
  }

  /**
   * Gastos del periodo en una sola lectura: totales, rubros y eventos diarios.
   */
  private queryPeriodExpenseFacts(scope: ReportsScope): Promise<{
    expenses: number;
    expensesCount: number;
    provisions: number;
    tolls: number;
    operatorSpend: number;
    maintenanceSpend: number;
    kindRows: Array<{ kind: string; has_trip: number; sum: string; count: string }>;
    expenseEvents: Array<{ date: string; label: string; amount: string }>;
    payableEvents: Array<{ date: string; label: string; amount: string }>;
  }> {
    const schema = this.expensesRepo.metadata.schema;
    const period = occurredInOperationalPeriod('e.incurred_at', '$2', '$3');

    return this.expensesRepo
      .query(
        `
      SELECT
        e.kind,
        e.trip_id,
        (e.paid_at IS NOT NULL) AS is_paid,
        e.amount::float AS amount,
        to_char((e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date, 'YYYY-MM-DD') AS date,
        COALESCE(
          NULLIF(TRIM(e.description), ''),
          NULLIF(TRIM(e.vendor), ''),
          NULLIF(TRIM(e.category), ''),
          INITCAP(REPLACE(TRIM(e.kind), '_', ' '))
        ) AS label
      FROM ${schema}.expenses e
      WHERE e.company_id = $1
        AND e.discarded_at IS NULL
        AND ${period}
      ORDER BY e.incurred_at ASC, e.id ASC
      `,
        [scope.companyId, scope.from, scope.to],
      )
      .then(
        (
          rows: Array<{
            kind: string | null;
            trip_id: number | null;
            is_paid: boolean | string | null;
            amount: string | number | null;
            date: string | null;
            label: string | null;
          }>,
        ) => {
          let expenses = 0;
          let expensesCount = 0;
          let provisions = 0;
          let tolls = 0;
          let operatorSpend = 0;
          let maintenanceSpend = 0;
          const kindBuckets = new Map<
            string,
            { kind: string; has_trip: number; sum: number; count: number }
          >();
          const expenseEvents: Array<{ date: string; label: string; amount: string }> =
            [];
          const payableEvents: Array<{ date: string; label: string; amount: string }> =
            [];
          const payableKinds = new Set<string>(LEDGER_PAYABLE_KINDS);

          for (const row of rows) {
            const kind = String(row.kind ?? '');
            const amount = Number(row.amount ?? 0);
            const cents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;
            const paid =
              row.is_paid === true || row.is_paid === 't' || row.is_paid === 'true';
            const passesPaidGate = !EXPENSE_PAID_GATE_KINDS.has(kind) || paid;
            const hasTrip = row.trip_id != null ? 1 : 0;

            if (kind === 'operational_control') {
              provisions += cents;
            }
            if (passesPaidGate) {
              expenses += cents;
              expensesCount += 1;
              if (kind !== 'operational_control') {
                const key = `${kind}|${hasTrip}`;
                const bucket = kindBuckets.get(key) ?? {
                  kind,
                  has_trip: hasTrip,
                  sum: 0,
                  count: 0,
                };
                bucket.sum += cents;
                bucket.count += 1;
                kindBuckets.set(key, bucket);
              }
            }
            if (kind === 'tolls') {
              tolls += cents;
            }
            if (kind === 'operator_payment' || kind === 'operator_commission') {
              operatorSpend += cents;
            }
            if (kind === 'maintenance' || kind === 'repair' || kind === 'tires') {
              maintenanceSpend += cents;
            }

            const event = {
              date: String(row.date ?? ''),
              label: String(row.label ?? ''),
              amount: String(cents / 100),
            };
            if (passesPaidGate && event.date) {
              expenseEvents.push(event);
            }
            if (!paid && payableKinds.has(kind) && event.date) {
              payableEvents.push(event);
            }
          }

          const fromCents = (value: number) => value / 100;
          return {
            expenses: fromCents(expenses),
            expensesCount,
            provisions: fromCents(provisions),
            tolls: fromCents(tolls),
            operatorSpend: fromCents(operatorSpend),
            maintenanceSpend: fromCents(maintenanceSpend),
            kindRows: [...kindBuckets.values()].map((bucket) => ({
              kind: bucket.kind,
              has_trip: bucket.has_trip,
              sum: String(fromCents(bucket.sum)),
              count: String(bucket.count),
            })),
            expenseEvents,
            payableEvents,
          };
        },
      );
  }

  /** Margen por cliente y totales de rentabilidad, con un solo agregado de gastos. */
  private queryClientProfitability(scope: ReportsScope): Promise<
    Array<{
      client_name: string;
      revenue: string;
      cost: string;
      direct_cost: string;
      trip_expenses: string;
      trip_count: string;
    }>
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const resolvedCost = this.tripResolvedCostSql('trip', 'te.trip_expense');
    const directCost = this.tripDirectCostSql('trip');
    const schema = this.tripsRepo.metadata.schema;
    const completedPeriod = occurredInOperationalPeriod(
      'trip.completed_at',
      '$2',
      '$3',
    );
    const tripExpenses = `(
        SELECT
          e.trip_id,
          COALESCE(SUM(e.amount), 0)::float AS trip_expense,
          BOOL_OR(${this.tripProgrammedLedgerKindCondition('e')}) AS has_programmed_ledger
        FROM ${schema}.expenses e
        WHERE e.company_id = $1
          AND e.discarded_at IS NULL
          AND e.kind <> 'operational_control'
          AND e.trip_id IN (
            SELECT trip.id
            FROM ${schema}.trips trip
            WHERE trip.company_id = $1
              AND trip.deleted_at IS NULL
              AND trip.status = 'completed'
              AND trip.completed_at IS NOT NULL
              AND ${completedPeriod}
              AND ${this.billableTripCondition('trip')}
              ${filter.sql}
          )
        GROUP BY e.trip_id
      )`;

    return this.tripsRepo.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente') AS client_name,
        COALESCE(SUM(trip.client_charge), 0)::float AS revenue,
        COALESCE(SUM(${resolvedCost}), 0)::float AS cost,
        COALESCE(SUM(
          CASE
            WHEN COALESCE(te.has_programmed_ledger, false) THEN 0
            ELSE ${directCost}
          END
        ), 0)::float AS direct_cost,
        COALESCE(SUM(COALESCE(te.trip_expense, 0)), 0)::float AS trip_expenses,
        COUNT(*)::int AS trip_count
      FROM ${schema}.trips trip
      LEFT JOIN ${tripExpenses} te ON te.trip_id = trip.id
      WHERE trip.company_id = $1
        AND trip.deleted_at IS NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND ${completedPeriod}
        AND ${this.billableTripCondition('trip')}
        ${filter.sql}
      GROUP BY trip.client_id, trip.client_name
      HAVING COALESCE(SUM(trip.client_charge), 0) > 0
      ORDER BY revenue DESC
      `,
      params,
    );
  }

  private buildDailyActivity(
    incomeRows: Array<{ date: string; label: string; amount: string }>,
    expenseRows: Array<{ date: string; label: string; amount: string }>,
    receivableRows: Array<{ date: string; label: string; amount: string }>,
    payableRows: Array<{ date: string; label: string; amount: string }>,
    from: string,
    to: string,
  ): ReportsBalanceDailyActivityDayDto[] {
    const byDate = new Map<string, ReportsBalanceDailyActivityEventDto[]>();

    const ensure = (date: string): ReportsBalanceDailyActivityEventDto[] => {
      let events = byDate.get(date);
      if (!events) {
        events = [];
        byDate.set(date, events);
      }
      return events;
    };

    for (const row of incomeRows) {
      const date = String(row.date ?? '').slice(0, 10);
      if (!date) continue;
      ensure(date).push({
        kind: 'income',
        label: String(row.label ?? 'Ingreso'),
        amount: Math.round(parseMoneySum(row.amount) * 100) / 100,
      });
    }

    for (const row of expenseRows) {
      const date = String(row.date ?? '').slice(0, 10);
      if (!date) continue;
      ensure(date).push({
        kind: 'expense',
        label: String(row.label ?? 'Gasto'),
        amount: Math.round(parseMoneySum(row.amount) * 100) / 100,
      });
    }

    for (const row of receivableRows) {
      const date = String(row.date ?? '').slice(0, 10);
      if (!date) continue;
      ensure(date).push({
        kind: 'receivable',
        label: String(row.label ?? 'Por cobrar'),
        amount: Math.round(parseMoneySum(row.amount) * 100) / 100,
      });
    }

    for (const row of payableRows) {
      const date = String(row.date ?? '').slice(0, 10);
      if (!date) continue;
      ensure(date).push({
        kind: 'payable',
        label: String(row.label ?? 'Por pagar'),
        amount: Math.round(parseMoneySum(row.amount) * 100) / 100,
      });
    }

    const days: ReportsBalanceDailyActivityDayDto[] = [];
    const cursor = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    while (cursor.getTime() <= end.getTime()) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const date = `${y}-${m}-${d}`;
      const events = byDate.get(date) ?? [];
      const incomeCount = events.filter((e) => e.kind === 'income').length;
      const expenseCount = events.filter((e) => e.kind === 'expense').length;
      const receivableCount = events.filter(
        (e) => e.kind === 'receivable',
      ).length;
      const payableCount = events.filter((e) => e.kind === 'payable').length;
      if (
        incomeCount > 0 ||
        expenseCount > 0 ||
        receivableCount > 0 ||
        payableCount > 0
      ) {
        days.push({
          date,
          incomeCount,
          expenseCount,
          receivableCount,
          payableCount,
          events,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }

  private queryDailyIncomeEvents(
    scope: ReportsScope,
  ): Promise<Array<{ date: string; label: string; amount: string }>> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;

    return this.tripsRepo.query(
      `
      SELECT
        to_char((trip.client_collected_at AT TIME ZONE '${OPERATIONAL_TZ}')::date, 'YYYY-MM-DD') AS date,
        CONCAT(
          COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente'),
          CASE
            WHEN NULLIF(TRIM(trip.maneuver_code), '') IS NOT NULL
            THEN CONCAT(' · ', TRIM(trip.maneuver_code))
            ELSE ''
          END
        ) AS label,
        trip.client_charge::float AS amount
      FROM ${schema}.trips trip
      WHERE trip.company_id = $1
        AND trip.deleted_at IS NULL
        AND ${this.billableTripCondition('trip')}
        AND trip.client_collected_at IS NOT NULL
        AND (trip.client_collected_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        ${filter.sql}
      ORDER BY trip.client_collected_at ASC, trip.id ASC
      `,
      params,
    );
  }

  private queryDailyExpenseEvents(
    scope: ReportsScope,
  ): Promise<Array<{ date: string; label: string; amount: string }>> {
    const schema = this.expensesRepo.metadata.schema;

    return this.expensesRepo.query(
      `
      SELECT
        to_char((e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date, 'YYYY-MM-DD') AS date,
        COALESCE(
          NULLIF(TRIM(e.description), ''),
          NULLIF(TRIM(e.vendor), ''),
          NULLIF(TRIM(e.category), ''),
          INITCAP(REPLACE(TRIM(e.kind), '_', ' '))
        ) AS label,
        e.amount::float AS amount
      FROM ${schema}.expenses e
      WHERE e.company_id = $1
        AND e.discarded_at IS NULL
        AND (e.kind NOT IN ('insurance','gps','tenure_payment','operator_payment','operator_commission') OR e.paid_at IS NOT NULL)
        AND (e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
      ORDER BY e.incurred_at ASC, e.id ASC
      `,
      [scope.companyId, scope.from, scope.to],
    );
  }

  private queryDailyReceivableEvents(
    scope: ReportsScope,
  ): Promise<Array<{ date: string; label: string; amount: string }>> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;

    return this.tripsRepo.query(
      `
      SELECT
        to_char(
          ((trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date + trip.credit_days),
          'YYYY-MM-DD'
        ) AS date,
        CONCAT(
          COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente'),
          CASE
            WHEN NULLIF(TRIM(trip.maneuver_code), '') IS NOT NULL
            THEN CONCAT(' · ', TRIM(trip.maneuver_code))
            ELSE ''
          END
        ) AS label,
        trip.client_charge::float AS amount
      FROM ${schema}.trips trip
      WHERE trip.company_id = $1
        AND trip.deleted_at IS NULL
        AND ${this.billableTripCondition('trip')}
        AND trip.client_collected_at IS NULL
        AND trip.completed_at IS NOT NULL
        AND ((trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date + trip.credit_days)
            BETWEEN $2::date AND $3::date
        ${filter.sql}
      ORDER BY ((trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date + trip.credit_days) ASC, trip.id ASC
      `,
      params,
    );
  }

  private queryDailyPayableEvents(
    scope: ReportsScope,
  ): Promise<Array<{ date: string; label: string; amount: string }>> {
    const schema = this.expensesRepo.metadata.schema;
    return this.expensesRepo.query(
      `
      SELECT
        to_char((e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date, 'YYYY-MM-DD') AS date,
        COALESCE(
          NULLIF(TRIM(e.description), ''),
          NULLIF(TRIM(e.vendor), ''),
          NULLIF(TRIM(e.category), ''),
          INITCAP(REPLACE(TRIM(e.kind), '_', ' '))
        ) AS label,
        e.amount::float AS amount
      FROM ${schema}.expenses e
      WHERE e.company_id = $1
        AND e.discarded_at IS NULL
        AND e.paid_at IS NULL
        AND e.kind IN ('insurance','gps','verification','tenure_payment','operator_payment','operator_commission')
        AND (e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
      ORDER BY e.incurred_at ASC, e.id ASC
      `,
      [scope.companyId, scope.from, scope.to],
    );
  }

  async getManiobras(
    companyId: number,
    query: ReportsGeneralQueryDto,
  ): Promise<ReportsManiobrasDto> {
    const scope = parseReportsScope(companyId, query);
    const previous = previousPeriodRange(scope.from, scope.to);

    const [
      maniobraScalars,
      containerTypeRows,
      recurringIncidentRows,
      operatorRows,
      clientRows,
      geoRows,
      ralentiTripRows,
    ] = await Promise.all([
      this.queryManiobraScalars(scope, previous),
      this.queryContainerTypeMix(scope),
      this.queryRecurringIncidentRoutes(scope),
      this.queryTopOperators(scope),
      this.queryTopClients(scope),
      this.queryGeoMapTrips(scope),
      this.queryManiobraRalentiTrips(scope),
    ]);

    const completedTripsCount = maniobraScalars.completedTripsCount;
    const completedTripsPriorCount = maniobraScalars.completedTripsPriorCount;
    const tripsInTransit = maniobraScalars.tripsInTransit;
    const tripsScheduledInPeriod = maniobraScalars.tripsScheduledInPeriod;
    const cancelledTripsCount = maniobraScalars.cancelledTripsCount;
    const totalOperationalKm = maniobraScalars.totalOperationalKm;
    const uniqueDestinations = maniobraScalars.uniqueDestinations;
    const avgManeuverDurationDays = maniobraScalars.avgManeuverDurationDays;
    const avgKmPerTrip =
      completedTripsCount > 0
        ? Math.round((totalOperationalKm / completedTripsCount) * 10) / 10
        : 0;

    const ralenti = buildManiobraRalentiReport(
      ralentiTripRows.map((row) => ({
        tripId: Number(row.trip_id) || 0,
        maneuverCode: String(row.maneuver_code ?? ''),
        clientName: String(row.client_name ?? 'Sin cliente'),
        destination: String(row.destination ?? 'Sin destino'),
        plannedDepartureAt: row.planned_departure_at,
        plannedArrivalAt: row.planned_arrival_at,
        plannedCompletionAt: row.planned_completion_at,
        departureAt: row.departure_at,
        arrivedAt: row.arrived_at,
        returnAt: row.return_at,
        estimatedArrivalTimeValue: row.estimated_arrival_time_value,
        estimatedReturnTimeValue: row.estimated_return_time_value,
      })),
    );

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
        ralentiHoursTotal: ralenti.totalHours,
        totalOperationalKm,
        avgKmPerTrip,
        avgManeuverDurationDays,
        uniqueDestinations,
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
        containerTypeMix: containerTypeRows.map((row) => ({
          containerType: String(row.container_type ?? 'na'),
          label: containerTypeLabelMx(String(row.container_type ?? '')),
          tripCount: Number(row.trip_count) || 0,
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
                returnAt: row.return_at,
                arrivedAt: row.arrived_at,
                plannedDepartureAt: row.planned_departure_at,
                plannedCompletionAt: row.planned_completion_at,
                plannedArrivalAt: row.planned_arrival_at,
              }),
              lat,
              lng,
            };
          })
          .filter((trip) => trip.tripId > 0),
        ralenti: {
          salidaClienteHours: ralenti.salidaClienteHours,
          clienteRegresoHours: ralenti.clienteRegresoHours,
          tripsEvaluated: ralenti.tripsEvaluated,
          tripsWithRalenti: ralenti.tripsWithRalenti,
        },
      },
    };
  }

  /** Conteos y km de maniobras en una pasada (periodo actual y anterior). */
  private queryManiobraScalars(
    scope: ReportsScope,
    previous: { from: string; to: string },
  ): Promise<{
    completedTripsCount: number;
    completedTripsPriorCount: number;
    tripsInTransit: number;
    tripsScheduledInPeriod: number;
    cancelledTripsCount: number;
    totalOperationalKm: number;
    uniqueDestinations: number;
    avgManeuverDurationDays: number;
  }> {
    const filter = tripScopeSql('trip', scope, 6);
    const params = [
      scope.companyId,
      scope.from,
      scope.to,
      previous.from,
      previous.to,
      ...filter.params,
    ];
    const schema = this.tripsRepo.metadata.schema;
    const completedNow = occurredInOperationalPeriod('trip.completed_at', '$2', '$3');
    const completedPrev = occurredInOperationalPeriod('trip.completed_at', '$4', '$5');
    const createdNow = occurredInOperationalPeriod('trip.created_at', '$2', '$3');
    const plannedNow = occurredInOperationalPeriod(
      'trip.planned_departure_at',
      '$2',
      '$3',
    );
    const scoped = `TRUE ${filter.sql}`;
    const durationEnd = `COALESCE(trip.return_at, trip.planned_completion_at, trip.arrived_at, trip.planned_arrival_at)`;
    const durationStart = `COALESCE(trip.departure_at, trip.planned_departure_at)`;

    return this.tripsRepo
      .query(
        `
      SELECT
        COUNT(*) FILTER (
          WHERE trip.status = 'completed'
            AND trip.completed_at IS NOT NULL
            AND ${completedNow}
            AND ${scoped}
        )::int AS completed,
        COUNT(*) FILTER (
          WHERE trip.status = 'completed'
            AND trip.completed_at IS NOT NULL
            AND ${completedPrev}
            AND ${scoped}
        )::int AS completed_prior,
        COUNT(*) FILTER (
          WHERE trip.status = 'in_transit'
        )::int AS in_transit,
        COUNT(*) FILTER (
          WHERE trip.status = 'scheduled'
            AND ${plannedNow}
            AND ${scoped}
        )::int AS scheduled,
        COUNT(*) FILTER (
          WHERE trip.status = 'cancelled'
            AND ${createdNow}
            AND ${scoped}
        )::int AS cancelled,
        COALESCE(SUM(${OPERATIONAL_KM_EXPR}) FILTER (
          WHERE trip.status = 'completed'
            AND trip.completed_at IS NOT NULL
            AND ${completedNow}
            AND ${scoped}
        ), 0)::float AS km,
        COUNT(DISTINCT CONCAT_WS(
          '|',
          COALESCE(trip.destination_postal_code, ''),
          COALESCE(trip.destination_locality, ''),
          COALESCE(trip.destination_city_municipality, '')
        )) FILTER (
          WHERE trip.status != 'cancelled'
            AND ${createdNow}
            AND ${DESTINATION_HAS_LABEL_SQL}
            AND ${scoped}
        )::int AS destinations,
        AVG(
          EXTRACT(EPOCH FROM (${durationEnd} - ${durationStart})) / 86400.0
        ) FILTER (
          WHERE trip.status = 'completed'
            AND trip.completed_at IS NOT NULL
            AND ${completedNow}
            AND ${durationEnd} IS NOT NULL
            AND ${durationStart} IS NOT NULL
            AND ${durationEnd} >= ${durationStart}
            AND ${scoped}
        )::float AS avg_days
      FROM ${schema}.trips trip
      WHERE trip.company_id = $1
        AND trip.deleted_at IS NULL
      `,
        params,
      )
      .then(
        (
          rows: Array<{
            completed: string | number;
            completed_prior: string | number;
            in_transit: string | number;
            scheduled: string | number;
            cancelled: string | number;
            km: string | number;
            destinations: string | number;
            avg_days: string | number | null;
          }>,
        ) => {
          const row = rows[0];
          return {
            completedTripsCount: Number(row?.completed) || 0,
            completedTripsPriorCount: Number(row?.completed_prior) || 0,
            tripsInTransit: Number(row?.in_transit) || 0,
            tripsScheduledInPeriod: Number(row?.scheduled) || 0,
            cancelledTripsCount: Number(row?.cancelled) || 0,
            totalOperationalKm:
              Math.round(parseMoneySum(row?.km) * 10) / 10,
            uniqueDestinations: Number(row?.destinations) || 0,
            avgManeuverDurationDays:
              Math.round(parseMoneySum(row?.avg_days) * 10) / 10,
          };
        },
      );
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

  private queryManiobraRalentiTrips(scope: ReportsScope): Promise<
    Array<{
      trip_id: number;
      maneuver_code: string | null;
      client_name: string | null;
      destination: string;
      planned_departure_at: Date | string | null;
      planned_arrival_at: Date | string | null;
      planned_completion_at: Date | string | null;
      departure_at: Date | string | null;
      arrived_at: Date | string | null;
      return_at: Date | string | null;
      estimated_arrival_time_value: string | null;
      estimated_return_time_value: string | null;
    }>
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;

    return this.tripsRepo.query(
      `
      SELECT
        trip.id AS trip_id,
        trip.maneuver_code,
        COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente') AS client_name,
        ${ROUTE_DESTINATION_LABEL_SQL} AS destination,
        trip.planned_departure_at,
        trip.planned_arrival_at,
        trip.planned_completion_at,
        trip.departure_at,
        trip.arrived_at,
        trip.return_at,
        rate.estimated_arrival_time_value,
        rate.estimated_return_time_value
      FROM ${schema}.trips trip
      LEFT JOIN ${schema}.destination_rates rate
        ON rate.id = trip.destination_rate_id
      WHERE trip.company_id = $1
        AND trip.deleted_at IS NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        AND (
          (trip.departure_at IS NOT NULL AND trip.arrived_at IS NOT NULL)
          OR (trip.arrived_at IS NOT NULL AND trip.return_at IS NOT NULL)
        )
        ${filter.sql}
      ORDER BY trip.completed_at DESC, trip.id DESC
      `,
      params,
    );
  }

  private sumOperationalKm(
    scope: ReportsScope,
  ): Promise<{ sum: string } | undefined> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select(
        `COALESCE(SUM(${OPERATIONAL_KM_EXPR}), 0)`,
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
        GROUP BY trip.destination_postal_code, trip.destination_locality, trip.destination_city_municipality
      ) grouped
      `,
        params,
      )
      .then((rows) => rows[0]);
  }

  private queryRecurringIncidentRoutes(scope: ReportsScope): Promise<
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
        MAX(inc.created_at) AS last_incident_at
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
        trip.destination_city_municipality
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
          'Sin operador'
        ) AS operator_name,
        COUNT(*)::int AS completed,
        COALESCE(SUM(${OPERATIONAL_KM_EXPR}), 0)::float AS km
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

  private queryGeoMapTrips(scope: ReportsScope): Promise<
    Array<{
      trip_id: string;
      maneuver_code: string;
      operator_name: string;
      client_name: string;
      status: string;
      departure_at: Date | string | null;
      return_at: Date | string | null;
      arrived_at: Date | string | null;
      planned_departure_at: Date | string | null;
      planned_completion_at: Date | string | null;
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
        trip.return_at,
        trip.arrived_at,
        trip.planned_departure_at,
        trip.planned_completion_at,
        trip.planned_arrival_at,
        COALESCE(NULLIF(TRIM(op.name), ''), 'Sin operador') AS operator_name,
        COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente') AS client_name,
        COALESCE(dr.destination_latitude, cd.latitude)::float AS lat,
        COALESCE(dr.destination_longitude, cd.longitude)::float AS lng
      FROM ${schema}.trips trip
      LEFT JOIN ${schema}.operators op ON op.id = trip.operator_id
      LEFT JOIN ${schema}.destination_rates dr ON dr.id = trip.destination_rate_id
      LEFT JOIN LATERAL (
        SELECT latitude, longitude
        FROM ${schema}.client_delivery
        WHERE (
            dr.id IS NULL
            OR dr.destination_latitude IS NULL
            OR dr.destination_longitude IS NULL
          )
          AND client_id = trip.client_id
          AND (
            trip.destination_postal_code IS NULL
            OR btrim(postal_code) = btrim(trip.destination_postal_code)
          )
        ORDER BY
          CASE
            WHEN trip.destination_locality IS NOT NULL
              AND lower(btrim(locality)) = lower(btrim(trip.destination_locality))
            THEN 0
            ELSE 1
          END,
          sort_order ASC,
          id ASC
        LIMIT 1
      ) cd ON true
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
   * Costo por maniobra sin duplicar ledger vs montos programados del trip.
   * Si hay gastos automáticos (diésel/casetas/operador) en ledger, usa la suma
   * total del ledger (incluye extras/reparaciones vinculados). Si no, usa montos
   * programados del trip más cualquier gasto extra vinculado.
   */
  private tripResolvedCostSql(
    tripAlias = 'trip',
    tripExpenseExpr = 'te.trip_expense',
    hasProgrammedLedgerExpr = 'te.has_programmed_ledger',
  ): string {
    const directCost = this.tripDirectCostSql(tripAlias);
    return `CASE
      WHEN COALESCE(${hasProgrammedLedgerExpr}, false) THEN COALESCE(${tripExpenseExpr}, 0)::float
      ELSE (${directCost}) + COALESCE(${tripExpenseExpr}, 0)::float
    END`;
  }

  /** Gastos automáticos al programar; activan modo ledger completo por maniobra. */
  private tripProgrammedLedgerKindCondition(expenseAlias = 'e'): string {
    return `LOWER(TRIM(COALESCE(${expenseAlias}.kind, ''))) IN ('fuel', 'tolls', 'operator_payment')`;
  }

  /**
   * Suma de gastos de ledger por maniobra (sin filtrar por periodo).
   * Incluye todos los rubros vinculados al trip (extras, reparaciones, etc.)
   * excepto provisiones operativas y descartados.
   */
  private tripLedgerExpenseSubquerySql(companyIdParam = '$1'): string {
    const schema = this.expensesRepo.metadata.schema;
    const programmedKinds = this.tripProgrammedLedgerKindCondition('e');
    return `(
        SELECT
          e.trip_id,
          COALESCE(SUM(e.amount), 0)::float AS trip_expense,
          BOOL_OR(${programmedKinds}) AS has_programmed_ledger
        FROM ${schema}.expenses e
        WHERE e.company_id = ${companyIdParam}
          AND e.trip_id IS NOT NULL
          AND e.discarded_at IS NULL
          AND e.kind <> 'operational_control'
        GROUP BY e.trip_id
      )`;
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

  private sumProvisions(
    scope: ReportsScope,
  ): Promise<{ sum: string } | undefined> {
    return this.expensesRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.companyId = :companyId', { companyId: scope.companyId })
      .andWhere('e.discardedAt IS NULL')
      .andWhere(
        `(e.kind = 'operational_control')`,
      )
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .getRawOne<{ sum: string }>();
  }

  private queryCreditByClient(scope: ReportsScope): Promise<
    Array<{
      client_name: string;
      amount: string;
      next_due: string | null;
      trip_count: string;
    }>
  > {
    const filter = tripScopeSql('trip', scope, 2);
    const params = [scope.companyId, ...filter.params];

    return this.tripsRepo.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente') AS client_name,
        COALESCE(SUM(trip.client_charge), 0)::float AS amount,
        COUNT(*)::int AS trip_count,
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
  ): Promise<
    Array<{ client_name: string; amount: string; trip_count: string }>
  > {
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

  private queryMarginByClient(scope: ReportsScope): Promise<
    Array<{
      client_name: string;
      revenue: string;
      cost: string;
      trip_count: string;
    }>
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const resolvedCost = this.tripResolvedCostSql('trip', 'te.trip_expense');

    const tripExpenses = this.tripLedgerExpenseSubquerySql('$1');

    return this.tripsRepo.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente') AS client_name,
        COALESCE(SUM(trip.client_charge), 0)::float AS revenue,
        COALESCE(SUM(${resolvedCost}), 0)::float AS cost,
        COUNT(*)::int AS trip_count
      FROM ${this.tripsRepo.metadata.schema}.trips trip
      LEFT JOIN ${tripExpenses} te ON te.trip_id = trip.id
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND ${this.completedBillableTripPeriodSql('trip')}
        ${filter.sql}
      GROUP BY trip.client_id, trip.client_name
      HAVING COALESCE(SUM(trip.client_charge), 0) > 0
      ORDER BY COALESCE(SUM(trip.client_charge), 0) DESC
      LIMIT 3
      `,
      params,
    );
  }

  private queryProfitabilityTotals(scope: ReportsScope): Promise<
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
    const tripExpenses = this.tripLedgerExpenseSubquerySql('$1');

    return this.tripsRepo
      .query(
        `
      SELECT
        COALESCE(SUM(trip.client_charge), 0)::float AS revenue,
        COALESCE(
          SUM(
            CASE
              WHEN COALESCE(te.has_programmed_ledger, false) THEN 0
              ELSE ${directCost}
            END
          ),
          0
        )::float AS direct_cost,
        COALESCE(SUM(COALESCE(te.trip_expense, 0)), 0)::float AS trip_expenses
      FROM ${this.tripsRepo.metadata.schema}.trips trip
      LEFT JOIN ${tripExpenses} te ON te.trip_id = trip.id
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND ${this.completedBillableTripPeriodSql('trip')}
        ${filter.sql}
      `,
        params,
      )
      .then((rows) => rows[0]);
  }

  private queryExpensesByKind(
    scope: ReportsScope,
  ): Promise<
    Array<{ kind: string; has_trip: string; sum: string; count: string }>
  > {
    return this.expensesRepo
      .createQueryBuilder('e')
      .select('e.kind', 'kind')
      .addSelect('CASE WHEN e.tripId IS NULL THEN 0 ELSE 1 END', 'has_trip')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'sum')
      .addSelect('COUNT(*)', 'count')
      .where('e.companyId = :companyId', { companyId: scope.companyId })
      .andWhere("e.kind <> 'operational_control'")
      .andWhere('e.discarded_at IS NULL')
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .andWhere(
        `(e.kind NOT IN ('insurance','gps','tenure_payment','operator_payment','operator_commission') OR e.paid_at IS NOT NULL)`,
      )
      .groupBy('e.kind')
      .addGroupBy('CASE WHEN e.tripId IS NULL THEN 0 ELSE 1 END')
      .getRawMany();
  }

  private applyTripScope(
    qb: SelectQueryBuilder<Trip>,
    scope: ReportsScope,
  ): SelectQueryBuilder<Trip> {
    return applyReportsTripScope(qb, scope);
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

  private sumExpenses(
    scope: ReportsScope,
  ): Promise<{ sum: string } | undefined> {
    return this.expensesRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.companyId = :companyId', { companyId: scope.companyId })
      .andWhere('e.discarded_at IS NULL')
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .andWhere(
        `(e.kind NOT IN ('insurance','gps','tenure_payment','operator_payment','operator_commission') OR e.paid_at IS NOT NULL)`,
      )
      .getRawOne<{ sum: string }>();
  }

  private countExpenses(scope: ReportsScope): Promise<number> {
    return this.expensesRepo
      .createQueryBuilder('e')
      .where('e.companyId = :companyId', { companyId: scope.companyId })
      .andWhere('e.discarded_at IS NULL')
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .andWhere(
        `(e.kind NOT IN ('insurance','gps','tenure_payment','operator_payment','operator_commission') OR e.paid_at IS NOT NULL)`,
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
      .andWhere(expenseNotDiscardedSql('e'))
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
          COALESCE(
            trip.return_at,
            trip.planned_completion_at,
            trip.arrived_at,
            trip.planned_arrival_at
          ) -
          COALESCE(trip.departure_at, trip.planned_departure_at)
        )) / 86400.0
      )::float AS avg_days
      FROM ${schema}.trips trip
      WHERE trip.company_id = $1
          AND trip.deleted_at IS NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND (trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN $2::date AND $3::date
        AND COALESCE(
          trip.return_at,
          trip.planned_completion_at,
          trip.arrived_at,
          trip.planned_arrival_at
        ) IS NOT NULL
        AND COALESCE(trip.departure_at, trip.planned_departure_at) IS NOT NULL
        AND COALESCE(
          trip.return_at,
          trip.planned_completion_at,
          trip.arrived_at,
          trip.planned_arrival_at
        ) >= COALESCE(trip.departure_at, trip.planned_departure_at)
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

  private queryOperationMix(
    scope: ReportsScope,
  ): Promise<
    Array<{ operationType: string; nameSnapshot: string | null; count: string }>
  > {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin(
        CompanyOperationConfiguration,
        'cfg',
        'cfg.id = trip.operation_configuration_id',
      )
      .select('trip.operationType', 'operationType')
      .addSelect('cfg.name', 'nameSnapshot')
      .addSelect('COUNT(*)', 'count')
      .where('trip.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere(
        `(trip.created_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      )
      .groupBy('trip.operationType')
      .addGroupBy('cfg.name')
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
      fleetTripTotals,
      fleetUnitRows,
      maintenanceEventRows,
      maintenanceEventsCount,
      maintenanceSpendRow,
    ] = await Promise.all([
      this.fleetOverview.listOverview(scope.companyId, undefined, {
        includeEquipmentRows: false,
      }),
      this.queryFleetTripTotals(scope),
      this.queryFleetUnits(scope),
      this.queryFleetMaintenanceEvents(scope),
      this.countFleetMaintenanceEvents(scope),
      this.sumFleetExpenseKind(scope, ['maintenance', 'repair', 'tires']),
    ]);
    const topUnitRows = fleetUnitRows.slice(0, 8);
    const tireWearRows = fleetUnitRows;

    const statusMix = buildReportsFleetStatusMix(overview.items);
    const complianceUnits = buildReportsFleetComplianceUnits(overview.items);

    const avgDaysWithoutOperation = computeAvgDaysWithoutOperation(
      overview.items,
    );

    const totalOperationalKm = fleetTripTotals.totalOperationalKm;
    const totalDieselLiters = fleetTripTotals.totalDieselLiters;
    const totalDieselAmount = fleetTripTotals.totalDieselAmount;
    const maintenanceSpendInPeriod =
      Math.round(parseMoneySum(maintenanceSpendRow?.sum) * 100) / 100;

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
        maintenanceEvents: maintenanceEventRows.map((row) => {
          const notesRaw = row.notes != null ? String(row.notes).trim() : '';
          return {
            entryId: Number(row.entry_id) || 0,
            assetLabel: String(row.asset_label ?? '—'),
            assetKind: row.equipment_id != null ? 'equipment' : 'unit',
            entryDate: row.entry_date ? String(row.entry_date) : null,
            entryType: String(row.entry_type ?? '—'),
            // status ya no vive en fleet_maintenance_entries (PRD slim).
            status: 'Registrado',
            cost: Math.round(parseMoneySum(row.cost) * 100) / 100,
            notes: notesRaw.length > 0 ? notesRaw : null,
          };
        }),
        complianceUnits,
        tireWearByUnit: tireWearRows.map((row) => {
          const operationalKm =
            Math.round(parseMoneySum(row.km) * 10) / 10;
          const avgWeightTons =
            Math.round(parseApproxWeightTons(row.avg_weight_tons) * 10) / 10;
          const wear = estimateTireWearMxn(operationalKm, avgWeightTons);
          return {
            unitCode: String(row.unit_label ?? '—'),
            tripCount: Number(row.completed) || 0,
            operationalKm,
            avgWeightTons,
            tireWearMxn: wear.tireWearMxn,
            tireCpkMxn: wear.tireCpkMxn,
            tireLifeUsedPercent: wear.tireLifeUsedPercent,
          };
        }),
      },
    };
  }

  private queryFleetTripTotals(scope: ReportsScope): Promise<{
    totalOperationalKm: number;
    totalDieselLiters: number;
    totalDieselAmount: number;
  }> {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const period = occurredInOperationalPeriod('trip.completed_at', '$2', '$3');
    const schema = this.tripsRepo.metadata.schema;

    return this.tripsRepo
      .query(
        `
      SELECT
        COALESCE(SUM(${OPERATIONAL_KM_EXPR}), 0)::float AS km,
        COALESCE(SUM(COALESCE(${sqlTripNumeric('trip.diesel_liters')}, 0)), 0)::float AS liters,
        COALESCE(SUM(COALESCE(${sqlTripNumeric('trip.diesel_amount')}, 0)), 0)::float AS amount
      FROM ${schema}.trips trip
      WHERE trip.company_id = $1
        AND trip.deleted_at IS NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND ${period}
        ${filter.sql}
      `,
        params,
      )
      .then((rows: Array<{ km: string; liters: string; amount: string }>) => {
        const row = rows[0];
        return {
          totalOperationalKm: Math.round(parseMoneySum(row?.km) * 10) / 10,
          totalDieselLiters: Math.round(parseMoneySum(row?.liters) * 10) / 10,
          totalDieselAmount: Math.round(parseMoneySum(row?.amount) * 100) / 100,
        };
      });
  }

  private queryFleetUnits(scope: ReportsScope): Promise<
    Array<{
      unit_label: string;
      completed: string;
      km: string;
      diesel_liters: string;
      avg_weight_tons: string | null;
    }>
  > {
    const filter = tripScopeSql('trip', scope, 4);
    const params = [scope.companyId, scope.from, scope.to, ...filter.params];
    const schema = this.tripsRepo.metadata.schema;
    const period = occurredInOperationalPeriod('trip.completed_at', '$2', '$3');

    return this.tripsRepo.query(
      `
      SELECT
        ${UNIT_OPERATIONAL_CODE_SQL} AS unit_label,
        COUNT(*)::int AS completed,
        COALESCE(SUM(${OPERATIONAL_KM_EXPR}), 0)::float AS km,
        COALESCE(SUM(COALESCE(${sqlTripNumeric('trip.diesel_liters')}, 0)), 0)::float AS diesel_liters,
        ${AVG_APPROX_WEIGHT_TONS_SQL} AS avg_weight_tons
      FROM ${schema}.trips trip
      INNER JOIN ${schema}.units unit ON unit.id = trip.unit_id
      WHERE trip.company_id = $1
        AND trip.deleted_at IS NULL
        AND trip.status = 'completed'
        AND trip.completed_at IS NOT NULL
        AND trip.unit_id IS NOT NULL
        AND ${period}
        ${filter.sql}
      GROUP BY trip.unit_id, unit.id, unit.trailer_brand_abbr, unit.trailer_year, unit.plate
      HAVING COUNT(*) > 0
      ORDER BY km DESC, completed DESC
      LIMIT 12
      `,
      params,
    );
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
    return this.applyTripScope(qb, scope).getRawOne<{
      liters: string;
      amount: string;
    }>();
  }

  private queryTopUnitsByKm(scope: ReportsScope): Promise<
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
        COALESCE(SUM(${OPERATIONAL_KM_EXPR}), 0)::float AS km,
        COALESCE(SUM(COALESCE(${sqlTripNumeric('trip.diesel_liters')}, 0)), 0)::float AS diesel_liters
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
        INNER JOIN ${schema}.units u ON u.id = me.unit_id
        WHERE u.company_id = $1
          AND me.entry_date IS NOT NULL
          AND me.entry_date BETWEEN $2::date AND $3::date
        `,
        [scope.companyId, scope.from, scope.to],
      )
      .then((rows) => Number(rows[0]?.count ?? 0) || 0);
  }

  private queryFleetMaintenanceEvents(scope: ReportsScope): Promise<
    Array<{
      entry_id: number;
      asset_label: string;
      unit_id: number | null;
      equipment_id: number | null;
      entry_date: string | null;
      entry_type: string | null;
      cost: string | null;
      notes: string | null;
    }>
  > {
    const schema = this.maintenanceEntriesRepo.metadata.schema;
    return this.maintenanceEntriesRepo.query(
      `
      SELECT
        me.id AS entry_id,
        COALESCE(${UNIT_OPERATIONAL_CODE_SQL}, '—') AS asset_label,
        me.unit_id,
        NULL::int AS equipment_id,
        me.entry_date::text AS entry_date,
        me.entry_type,
        me.cost,
        me.notes
      FROM ${schema}.fleet_maintenance_entries me
      INNER JOIN ${schema}.units unit ON unit.id = me.unit_id
      WHERE unit.company_id = $1
        AND me.entry_date IS NOT NULL
        AND me.entry_date BETWEEN $2::date AND $3::date
      ORDER BY me.entry_date DESC, me.id DESC
      LIMIT 12
      `,
      [scope.companyId, scope.from, scope.to],
    );
  }

  private queryTireWearByUnit(scope: ReportsScope): Promise<
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
        COALESCE(SUM(${OPERATIONAL_KM_EXPR}), 0)::float AS operational_km,
        ${AVG_APPROX_WEIGHT_TONS_SQL} AS avg_weight_tons
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
      .andWhere(
        '(e.relatedUnitId IS NOT NULL OR e.relatedEquipmentId IS NOT NULL)',
      )
      .andWhere(expenseNotDiscardedSql('e'))
      .andWhere(
        `(e.incurred_at AT TIME ZONE '${OPERATIONAL_TZ}')::date BETWEEN :from AND :to`,
        { from: scope.from, to: scope.to },
      );
    return qb.getRawOne<{ sum: string }>();
  }
}
