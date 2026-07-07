import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { isAdminRole } from 'src/common/constants/app-modules';
import { serializeExpense } from 'src/common/serializers/expense.serializer';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import type AuthUser from 'src/types/auth-user.type';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import {
  expenseTextColumn,
  mergeExpenseRelationForNormalize,
  normalizeExpenseRelationFields,
} from 'src/expenses/expense-payload.util';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { ExpensesCalendarQueryDto } from './dto/expenses-calendar-query.dto';
import {
  applyExpenseListFilters,
  normalizeExpenseListLimit,
} from './expenses-list.util';
import {
  buildExpenseCalendarProjection,
  paginateExpenseCalendarEntries,
  type ExpenseCalendarEntry,
  type ExpenseCalendarMarker,
} from './expenses-calendar-projection.util';
import { buildTripAutoExpenses } from 'src/trips/trip-auto-expenses.util';
import { parseOperationalIncurredAt } from './expenses-incurred-at.util';
import { fleetInsuranceIncurredAtMatchSql } from './expenses-insurance-dedup.util';
import { ExpensesInsuranceFleetReconcileService } from './expenses-insurance-fleet-reconcile.service';
import { ExpensesMaintenanceFleetReconcileService } from './expenses-maintenance-fleet-reconcile.service';
import { ExpensesVerificationFleetReconcileService } from './expenses-verification-fleet-reconcile.service';

export interface ExpensesListResult {
  items: ReturnType<typeof serializeExpense>[];
  total: number;
  page: number;
  limit: number;
  totalAmount: string;
}

export interface ExpensesCalendarItem extends ExpenseCalendarEntry {
  expense?: ReturnType<typeof serializeExpense>;
}

export interface ExpensesCalendarResult {
  from: string;
  to: string;
  items: ExpensesCalendarItem[];
  total: number;
  page: number;
  limit: number;
  markers: ExpenseCalendarMarker[];
  summary: {
    actualCount: number;
    actualTotalAmount: string;
    projectedCount: number;
    projectedTotalAmount: string;
    grandCount: number;
    grandTotalAmount: string;
  };
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly repo: Repository<Expense>,
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(Unit)
    private readonly unitsRepo: Repository<Unit>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(Operator)
    private readonly operatorsRepo: Repository<Operator>,
    private readonly insuranceFleetReconcile: ExpensesInsuranceFleetReconcileService,
    private readonly maintenanceFleetReconcile: ExpensesMaintenanceFleetReconcileService,
    private readonly verificationFleetReconcile: ExpensesVerificationFleetReconcileService,
  ) {}

  async create(companyId: number, dto: CreateExpenseDto) {
    const relatedUnitId = dto.relatedUnitId
      ? await this.resolveUnitId(companyId, dto.relatedUnitId)
      : undefined;
    const relatedEquipmentId = dto.relatedEquipmentId
      ? await this.resolveEquipmentId(companyId, dto.relatedEquipmentId)
      : undefined;
    const relationFields = normalizeExpenseRelationFields({
      kind: dto.kind,
      maintenanceTarget: dto.maintenanceTarget,
      insuranceTarget: dto.insuranceTarget,
      verificationScope: dto.verificationScope,
      relatedUnitId: relatedUnitId ?? null,
      relatedEquipmentId: relatedEquipmentId ?? null,
    });

    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        category: dto.category,
        amount: String(dto.amount),
        currency: dto.currency ?? 'MXN',
        incurredAt: parseOperationalIncurredAt(dto.incurredAt),
        kind: dto.kind,
        tripId: dto.tripId
          ? await this.resolveTripId(companyId, dto.tripId)
          : undefined,
        relatedUnitId,
        relatedEquipmentId,
        relatedOperatorId: dto.relatedOperatorId
          ? await this.resolveOperatorId(companyId, dto.relatedOperatorId)
          : undefined,
        description: dto.description,
        vendor: expenseTextColumn(dto.vendor),
        paymentMethod: expenseTextColumn(dto.paymentMethod),
        maintenanceTarget: relationFields.maintenanceTarget,
        insuranceTarget: relationFields.insuranceTarget,
        verificationScope: relationFields.verificationScope,
        invoiceRequired: dto.invoiceRequired ?? false,
        isOperationalProvision: dto.isOperationalProvision ?? false,
      }),
    );
    return this.findOne(companyId, saved.id);
  }

  /** Gastos operativos automáticos tras crear una maniobra (control operativo asistido). */
  async createAutoExpensesForTrip(
    companyId: number,
    trip: Trip,
    maintenanceProvisionPercent = 5,
  ): Promise<void> {
    const drafts = buildTripAutoExpenses(trip, { maintenanceProvisionPercent });
    if (drafts.length === 0) {
      return;
    }

    await this.repo.save(
      drafts.map((draft) =>
        this.repo.create({
          companyId,
          tripId: trip.id,
          category: draft.category,
          amount: draft.amount,
          currency: draft.currency,
          incurredAt: draft.incurredAt,
          kind: draft.kind,
          description: draft.description,
          relatedUnitId: draft.relatedUnitId,
          relatedOperatorId: draft.relatedOperatorId,
          isOperationalProvision: draft.isOperationalProvision,
        }),
      ),
    );
  }

  async findAll(companyId: number, query?: ListExpensesQueryDto): Promise<ExpensesListResult> {
    const limit = normalizeExpenseListLimit(query?.limit);
    const page = Math.max(1, query?.page ?? 1);

    const baseQb = this.repo.createQueryBuilder('e');
    applyExpenseListFilters(baseQb, companyId, query);

    const total = await baseQb.clone().getCount();

    const sumRow = await baseQb
      .clone()
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .getRawOne<{ sum: string }>();
    const totalAmount = sumRow?.sum ?? '0';

    const rowsQb = this.repo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.trip', 'trip')
      .leftJoinAndSelect('e.relatedUnit', 'relatedUnit')
      .leftJoinAndSelect('e.relatedEquipment', 'relatedEquipment')
      .leftJoinAndSelect('e.relatedOperator', 'relatedOperator');
    applyExpenseListFilters(rowsQb, companyId, query);
    rowsQb.orderBy('e.incurredAt', 'DESC');

    if (limit > 0) {
      rowsQb.skip((page - 1) * limit).take(limit);
    }

    const rows = await rowsQb.getMany();

    return {
      items: rows.map((row) => serializeExpense(row)),
      total,
      page: limit > 0 ? page : 1,
      limit: limit > 0 ? limit : total,
      totalAmount,
    };
  }

  async getCalendar(
    companyId: number,
    query: ExpensesCalendarQueryDto,
  ): Promise<ExpensesCalendarResult> {
    const from = query.from.trim();
    const to = query.to.trim();
    const limit = normalizeExpenseListLimit(query.limit);
    const page = Math.max(1, query.page ?? 1);

    const projectionKinds = [
      'fuel',
      'tolls',
      'per_diem',
      'operator_payment',
      'operator_commission',
      'insurance',
      'gps',
      'verification',
    ] as const;

    const [actualResult, trips, units, equipment, operators, dedupExpenses] =
      await Promise.all([
        this.findAll(companyId, { from, to, limit: 0 }),
        this.tripsRepo.find({
          where: {
            companyId,
            status: In(['scheduled', 'in_transit', 'completed']),
          },
        }),
        this.unitsRepo.find({
          where: { companyId },
          relations: ['fleetProfile'],
        }),
        this.equipmentRepo.find({
          where: { companyId },
          relations: ['fleetProfile'],
        }),
        this.operatorsRepo.find({ where: { companyId } }),
        this.repo.find({
          where: {
            companyId,
            discardedAt: IsNull(),
            kind: In([...projectionKinds]),
          },
        }),
      ]);

    const projection = buildExpenseCalendarProjection({
      from,
      to,
      trips,
      units,
      equipment,
      operators,
      expenses: dedupExpenses,
      actualItems: actualResult.items,
    });

    const paginated = paginateExpenseCalendarEntries(projection.entries, page, limit);
    const expenseById = new Map(
      actualResult.items.map((item) => [Number(item['id']), item]),
    );

    const items: ExpensesCalendarItem[] = paginated.items.map((entry) => ({
      ...entry,
      expense:
        entry.entryType === 'actual' && entry.expenseId != null
          ? expenseById.get(entry.expenseId)
          : undefined,
    }));

    const formatTotal = (value: number) => value.toFixed(2);

    return {
      from,
      to,
      items,
      total: paginated.total,
      page: paginated.page,
      limit: paginated.limit,
      markers: projection.markers,
      summary: {
        actualCount: projection.summary.actualCount,
        actualTotalAmount: formatTotal(projection.summary.actualTotalAmount),
        projectedCount: projection.summary.projectedCount,
        projectedTotalAmount: formatTotal(projection.summary.projectedTotalAmount),
        grandCount: projection.summary.grandCount,
        grandTotalAmount: formatTotal(projection.summary.grandTotalAmount),
      },
    };
  }

  async findOne(companyId: number, expenseId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: expenseId, discardedAt: IsNull() },
      relations: ['trip', 'relatedUnit', 'relatedEquipment', 'relatedOperator'],
    });
    if (!row) {
      throw new NotFoundException(`Expense ${expenseId} not found`);
    }
    return serializeExpense(row);
  }

  async hasFleetInsuranceExpenseOnDate(
    companyId: number,
    params: {
      insuranceTarget: 'unit' | 'equipment';
      relatedUnitId?: number;
      relatedEquipmentId?: number;
      incurredDate: string;
    },
  ): Promise<boolean> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.companyId = :companyId', { companyId })
      .andWhere('e.kind = :kind', { kind: 'insurance' })
      .andWhere('e.discardedAt IS NULL')
      .andWhere(fleetInsuranceIncurredAtMatchSql('e'), {
        incurredDate: params.incurredDate,
      });
    if (params.insuranceTarget === 'unit' && params.relatedUnitId != null) {
      qb.andWhere('e.relatedUnitId = :relatedUnitId', {
        relatedUnitId: params.relatedUnitId,
      });
    } else if (
      params.insuranceTarget === 'equipment' &&
      params.relatedEquipmentId != null
    ) {
      qb.andWhere('e.relatedEquipmentId = :relatedEquipmentId', {
        relatedEquipmentId: params.relatedEquipmentId,
      });
    } else {
      return false;
    }
    return (await qb.getCount()) > 0;
  }

  async hasFleetInsuranceExpenseWithDescription(
    companyId: number,
    params: {
      insuranceTarget: 'unit' | 'equipment';
      relatedUnitId?: number;
      relatedEquipmentId?: number;
      description: string;
    },
  ): Promise<boolean> {
    const description = params.description.trim();
    if (!description) {
      return false;
    }
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.companyId = :companyId', { companyId })
      .andWhere('e.kind = :kind', { kind: 'insurance' })
      .andWhere('e.discardedAt IS NULL')
      .andWhere('e.description = :description', { description });
    if (params.insuranceTarget === 'unit' && params.relatedUnitId != null) {
      qb.andWhere('e.relatedUnitId = :relatedUnitId', {
        relatedUnitId: params.relatedUnitId,
      });
    } else if (
      params.insuranceTarget === 'equipment' &&
      params.relatedEquipmentId != null
    ) {
      qb.andWhere('e.relatedEquipmentId = :relatedEquipmentId', {
        relatedEquipmentId: params.relatedEquipmentId,
      });
    } else {
      return false;
    }
    return (await qb.getCount()) > 0;
  }

  async hasFleetGpsExpenseOnDate(
    companyId: number,
    params: {
      relatedUnitId: number;
      incurredDate: string;
    },
  ): Promise<boolean> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.companyId = :companyId', { companyId })
      .andWhere('e.kind = :kind', { kind: 'gps' })
      .andWhere('e.discardedAt IS NULL')
      .andWhere('e.relatedUnitId = :relatedUnitId', {
        relatedUnitId: params.relatedUnitId,
      })
      .andWhere(fleetInsuranceIncurredAtMatchSql('e'), {
        incurredDate: params.incurredDate,
      });
    return (await qb.getCount()) > 0;
  }

  async hasFleetGpsExpenseWithDescription(
    companyId: number,
    params: {
      relatedUnitId: number;
      description: string;
    },
  ): Promise<boolean> {
    const description = params.description.trim();
    if (!description) {
      return false;
    }
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.companyId = :companyId', { companyId })
      .andWhere('e.kind = :kind', { kind: 'gps' })
      .andWhere('e.discardedAt IS NULL')
      .andWhere('e.relatedUnitId = :relatedUnitId', {
        relatedUnitId: params.relatedUnitId,
      })
      .andWhere('e.description = :description', { description });
    return (await qb.getCount()) > 0;
  }

  /** Descarta gastos vinculados a una maniobra eliminada (soft delete operativo). */
  async discardByTripId(companyId: number, tripId: number): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Expense)
      .set({ discardedAt: new Date() })
      .where('company_id = :companyId', { companyId })
      .andWhere('trip_id = :tripId', { tripId })
      .andWhere('discarded_at IS NULL')
      .execute();
    return result.affected ?? 0;
  }

  async update(companyId: number, expenseId: number, dto: UpdateExpenseDto) {
    const existing = await this.repo.findOne({
      where: { companyId, id: expenseId },
    });
    if (!existing) {
      throw new NotFoundException(`Expense ${expenseId} not found`);
    }

    const {
      amount,
      incurredAt,
      tripId,
      relatedUnitId,
      relatedEquipmentId,
      relatedOperatorId,
      vendor,
      paymentMethod,
      maintenanceTarget,
      insuranceTarget,
      verificationScope,
      kind,
      ...rest
    } = dto;

    const clears: Record<string, null> = {};
    if (tripId !== undefined && !tripId) {
      clears.tripId = null;
    }
    if (relatedUnitId !== undefined && !relatedUnitId) {
      clears.relatedUnitId = null;
    }
    if (relatedEquipmentId !== undefined && !relatedEquipmentId) {
      clears.relatedEquipmentId = null;
    }
    if (relatedOperatorId !== undefined && !relatedOperatorId) {
      clears.relatedOperatorId = null;
    }

    const resolvedRelatedUnitId =
      relatedUnitId !== undefined
        ? relatedUnitId
          ? await this.resolveUnitId(companyId, relatedUnitId)
          : null
        : undefined;
    const resolvedRelatedEquipmentId =
      relatedEquipmentId !== undefined
        ? relatedEquipmentId
          ? await this.resolveEquipmentId(companyId, relatedEquipmentId)
          : null
        : undefined;

    const relationFields = normalizeExpenseRelationFields(
      mergeExpenseRelationForNormalize(
        existing,
        { kind, maintenanceTarget, insuranceTarget, verificationScope },
        {
          relatedUnitId:
            resolvedRelatedUnitId !== undefined
              ? resolvedRelatedUnitId
              : existing.relatedUnitId,
          relatedEquipmentId:
            resolvedRelatedEquipmentId !== undefined
              ? resolvedRelatedEquipmentId
              : existing.relatedEquipmentId,
          relatedUnitIdTouched: relatedUnitId !== undefined,
          relatedEquipmentIdTouched: relatedEquipmentId !== undefined,
        },
      ),
    );

    await this.repo.update({ id: expenseId, companyId }, {
        ...rest,
        ...clears,
        ...(kind !== undefined && { kind }),
        ...(amount !== undefined && { amount: String(amount) }),
        ...(incurredAt && { incurredAt: parseOperationalIncurredAt(incurredAt) }),
        ...(tripId
          ? { tripId: await this.resolveTripId(companyId, tripId) }
          : {}),
        ...(resolvedRelatedUnitId !== undefined && relatedUnitId
          ? { relatedUnitId: resolvedRelatedUnitId }
          : {}),
        ...(resolvedRelatedEquipmentId !== undefined && relatedEquipmentId
          ? { relatedEquipmentId: resolvedRelatedEquipmentId }
          : {}),
        ...(relatedOperatorId
          ? {
              relatedOperatorId: await this.resolveOperatorId(
                companyId,
                relatedOperatorId,
              ),
            }
          : {}),
        ...(vendor !== undefined && { vendor: expenseTextColumn(vendor) }),
        ...(paymentMethod !== undefined && {
          paymentMethod: expenseTextColumn(paymentMethod),
        }),
        maintenanceTarget: relationFields.maintenanceTarget,
        insuranceTarget: relationFields.insuranceTarget,
        verificationScope: relationFields.verificationScope,
      } as Parameters<Repository<Expense>['update']>[1]);
    return this.findOne(companyId, expenseId);
  }

  async remove(companyId: number, expenseId: number, actor: AuthUser) {
    if (!isAdminRole(actor.role)) {
      throw new ForbiddenException('Solo administradores pueden eliminar gastos.');
    }
    const existing = await this.repo.findOne({
      where: { companyId, id: expenseId, discardedAt: IsNull() },
    });
    if (!existing) {
      throw new NotFoundException(`Expense ${expenseId} not found`);
    }
    await this.repo.update(
      { id: expenseId, companyId },
      { discardedAt: new Date() },
    );
    await this.insuranceFleetReconcile.reconcileAfterInsuranceExpenseDiscard(
      existing,
    );
    await this.maintenanceFleetReconcile.reconcileAfterMaintenanceExpenseDiscard(
      existing,
    );
    await this.insuranceFleetReconcile.reconcileAfterGpsExpenseDiscard(existing);
    await this.verificationFleetReconcile.reconcileAfterVerificationExpenseDiscard(
      existing,
    );
    return { id: expenseId, deleted: true };
  }

  private async resolveTripId(companyId: number, ref: string): Promise<number> {
    const tripId = parseOptionalNumericId(ref, 'Trip')!;
    const row = await this.tripsRepo.findOne({
      where: { companyId, id: tripId },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }
    return row.id;
  }

  private async resolveUnitId(companyId: number, ref: string): Promise<number> {
    const unitId = parseOptionalNumericId(ref, 'Unit')!;
    const row = await this.unitsRepo.findOne({
      where: { companyId, id: unitId },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
    return row.id;
  }

  private async resolveEquipmentId(
    companyId: number,
    ref: string,
  ): Promise<number> {
    const equipmentId = parseOptionalNumericId(ref, 'Equipment')!;
    const row = await this.equipmentRepo.findOne({
      where: { companyId, id: equipmentId },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Equipment ${equipmentId} not found`);
    }
    return row.id;
  }

  private async resolveOperatorId(
    companyId: number,
    ref: string,
  ): Promise<number> {
    const operatorId = parseOptionalNumericId(ref, 'Operator')!;
    const row = await this.operatorsRepo.findOne({
      where: { companyId, id: operatorId },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }
    return row.id;
  }
}
