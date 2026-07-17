import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Client } from 'src/clients/entities/client.entity';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import type {
  ClientBalanceOverviewItemDto,
  ClientBalanceOverviewResponseDto,
  ClientBalancePeriodSummaryDto,
  ClientBalanceSummaryDto,
} from './utils/client-balance.util';
import {
  buildClientBalancePeriodSummary,
  buildClientBalanceSummary,
  deriveClientCommercialHealthFromSummary,
} from './utils/client-balance.util';
import { parseMoney } from './utils/client-balance-money.util';
import {
  mapTripEntityToBalanceRow,
  type ClientBalanceExpenseRow,
} from './utils/client-balance-trip.util';

@Injectable()
export class ClientsBalanceService {
  constructor(
    @InjectRepository(Trip) private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(Expense)
    private readonly expensesRepo: Repository<Expense>,
    @InjectRepository(Client) private readonly clientsRepo: Repository<Client>,
  ) {}

  /**
   * Resumen ligero para las tarjetas del tab Balance: saldo por cobrar,
   * próximos cobros y conteos por estatus. Los conteos se agregan en SQL y
   * solo se cargan las maniobras con cobro abierto; los campos históricos
   * pesados (cobrado total, historial de pagos, volumen, margen) quedan en
   * cero aquí — el detalle por cliente los sirve `getClientBalance`.
   */
  async getBalanceOverview(
    companyId: number,
  ): Promise<ClientBalanceOverviewResponseDto> {
    const schema = this.tripsRepo.metadata.schema;
    const billableSql = `(
      COALESCE(t.has_client_billing, TRUE) = TRUE
      AND COALESCE(t.client_charge, 0) > 0
      AND (t.status = 'completed' OR (t.status = 'cancelled' AND t.false_maneuver = TRUE))
    )`;

    const countsQuery: Promise<
      Array<{
        client_id: number;
        total: number;
        completed: number;
        in_transit: number;
        scheduled: number;
        cancelled: number;
        billable: number;
      }>
    > = this.tripsRepo.query(
      `
      SELECT
        t.client_id AS client_id,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE t.status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE t.status = 'in_transit')::int AS in_transit,
        COUNT(*) FILTER (WHERE t.status = 'scheduled')::int AS scheduled,
        COUNT(*) FILTER (WHERE t.status = 'cancelled')::int AS cancelled,
        COUNT(*) FILTER (WHERE ${billableSql})::int AS billable
      FROM ${schema}.trips t
      WHERE t.company_id = $1
        AND t.deleted_at IS NULL
        AND t.client_id IS NOT NULL
      GROUP BY t.client_id
      `,
      [companyId],
    );

    const [clients, countRows, openTripEntities] = await Promise.all([
      this.clientsRepo.find({
        where: { companyId },
        select: ['id'],
        order: { name: 'ASC' },
      }),
      countsQuery,
      this.tripsRepo
        .createQueryBuilder('t')
        .where('t.companyId = :companyId', { companyId })
        .andWhere('t.deleted_at IS NULL')
        .andWhere('t.client_id IS NOT NULL')
        .andWhere('t.client_collected_at IS NULL')
        .andWhere(billableSql)
        .getMany(),
    ]);

    const openRows = openTripEntities.map((trip) =>
      mapTripEntityToBalanceRow(trip),
    );
    const countsByClientId = new Map(
      countRows.map((row) => [String(row.client_id), row]),
    );

    const asOf = new Date();
    const items: ClientBalanceOverviewItemDto[] = clients
      .map((client) => String(client.id))
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((clientId) => {
        const base = buildClientBalanceSummary(clientId, openRows, [], asOf);
        const counts = countsByClientId.get(clientId);
        const summary: ClientBalanceSummaryDto = {
          ...base,
          hasTrips: (counts?.total ?? 0) > 0,
          hasBillable: (counts?.billable ?? 0) > 0,
          completedCount: counts?.completed ?? 0,
          statusCounts: {
            completed: counts?.completed ?? 0,
            inTransit: counts?.in_transit ?? 0,
            scheduled: counts?.scheduled ?? 0,
            cancelled: counts?.cancelled ?? 0,
            total: counts?.total ?? 0,
          },
        };
        return {
          clientId,
          summary,
          commercialHealth: deriveClientCommercialHealthFromSummary(summary),
        };
      });

    return { asOf: asOf.toISOString(), items };
  }

  async getClientBalance(
    companyId: number,
    clientIdRef: string,
    periodFrom?: string,
    periodTo?: string,
  ): Promise<
    ClientBalanceSummaryDto & { period?: ClientBalancePeriodSummaryDto }
  > {
    const clientId = parseOptionalNumericId(clientIdRef, 'Client');
    if (clientId == null) {
      throw new NotFoundException('Client not found');
    }

    const tripEntities = await this.tripsRepo.find({
      where: { companyId, clientId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    const clientExists = await this.tripsRepo.manager.query(
      `SELECT 1 FROM ${this.tripsRepo.metadata.schema}.clients WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [clientId, companyId],
    );
    if (!clientExists?.length) {
      throw new NotFoundException('Client not found');
    }

    const trips = tripEntities.map((trip) => mapTripEntityToBalanceRow(trip));
    const tripIds = trips.map((trip) => Number(trip.id)).filter((id) => id > 0);
    const expenses =
      tripIds.length > 0
        ? await this.loadTripExpensesForIds(companyId, tripIds)
        : [];

    const summary = buildClientBalanceSummary(
      String(clientId),
      trips,
      expenses,
    );

    if (periodFrom && periodTo) {
      const period = buildClientBalancePeriodSummary(
        String(clientId),
        trips,
        expenses,
        periodFrom,
        periodTo,
      );
      return { ...summary, period };
    }

    return summary;
  }

  private async loadTripExpensesForIds(
    companyId: number,
    tripIds: number[],
  ): Promise<ClientBalanceExpenseRow[]> {
    const rows = await this.expensesRepo
      .createQueryBuilder('e')
      .select(['e.tripId', 'e.kind', 'e.amount'])
      .where('e.company_id = :companyId', { companyId })
      .andWhere('e.trip_id IN (:...tripIds)', { tripIds })
      .andWhere('e.discarded_at IS NULL')
      .getMany();

    return rows
      .filter((row) => row.tripId != null)
      .map((row) => ({
        tripId: String(row.tripId),
        kind: row.kind,
        amount: parseMoney(row.amount),
      }));
  }
}
