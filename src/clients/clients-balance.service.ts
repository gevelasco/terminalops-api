import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Client } from 'src/clients/entities/client.entity';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import type {
  ClientBalanceOverviewResponseDto,
  ClientBalancePeriodSummaryDto,
  ClientBalanceSummaryDto,
} from './utils/client-balance.util';
import {
  buildClientBalanceOverview,
  buildClientBalancePeriodSummary,
  buildClientBalanceSummary,
} from './utils/client-balance.util';
import { parseMoney } from './utils/client-balance-money.util';
import {
  mapTripEntityToBalanceRow,
  type ClientBalanceExpenseRow,
  type ClientBalanceTripRow,
} from './utils/client-balance-trip.util';

@Injectable()
export class ClientsBalanceService {
  constructor(
    @InjectRepository(Trip) private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(Expense) private readonly expensesRepo: Repository<Expense>,
    @InjectRepository(Client) private readonly clientsRepo: Repository<Client>,
  ) {}

  async getBalanceOverview(
    companyId: number,
  ): Promise<ClientBalanceOverviewResponseDto> {
    const [trips, expenses, clients] = await Promise.all([
      this.loadCompanyBalanceTrips(companyId),
      this.loadCompanyTripExpenses(companyId),
      this.clientsRepo.find({
        where: { companyId },
        select: ['id'],
        order: { name: 'ASC' },
      }),
    ]);
    const clientIds = clients.map((client) => String(client.id));
    return buildClientBalanceOverview(clientIds, trips, expenses);
  }

  async getClientBalance(
    companyId: number,
    clientIdRef: string,
    periodFrom?: string,
    periodTo?: string,
  ): Promise<ClientBalanceSummaryDto & { period?: ClientBalancePeriodSummaryDto }> {
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

    const summary = buildClientBalanceSummary(String(clientId), trips, expenses);

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

  private async loadCompanyBalanceTrips(
    companyId: number,
  ): Promise<ClientBalanceTripRow[]> {
    const rows = await this.tripsRepo.find({
      where: { companyId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return rows.map((trip) => mapTripEntityToBalanceRow(trip));
  }

  private async loadCompanyTripExpenses(
    companyId: number,
  ): Promise<ClientBalanceExpenseRow[]> {
    const rows = await this.expensesRepo
      .createQueryBuilder('e')
      .select(['e.tripId', 'e.kind', 'e.amount'])
      .where('e.company_id = :companyId', { companyId })
      .andWhere('e.trip_id IS NOT NULL')
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
