import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, type EntityManager } from 'typeorm';
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
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import {
  expenseActivityOnCreate,
  expenseActivityOnUpdate,
  expenseActivitySubjectLabel,
} from 'src/activity-events/activity-events.expense.util';

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
    private readonly activityEvents: ActivityEventsService,
  ) {}

  async create(companyId: number, dto: CreateExpenseDto, actor?: AuthUser) {
    const relatedUnitId = dto.relatedUnitId
      ? await this.resolveUnitId(companyId, dto.relatedUnitId)
      : undefined;
    const relatedEquipmentId = dto.relatedEquipmentId
      ? await this.resolveEquipmentId(companyId, dto.relatedEquipmentId)
      : undefined;
    const relationFields = normalizeExpenseRelationFields({
      kind: dto.kind,
      verificationScope: dto.verificationScope,
      category: dto.category,
      relatedUnitId: relatedUnitId ?? null,
      relatedEquipmentId: relatedEquipmentId ?? null,
    });

    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        category: relationFields.category ?? dto.category,
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
        description: dto.description?.trim() || relationFields.descriptionHint,
        vendor: expenseTextColumn(dto.vendor),
        paymentMethod: expenseTextColumn(dto.paymentMethod),
        invoiceRequired: dto.invoiceRequired ?? false,
        paidAt: dto.paidAt
          ? parseOperationalIncurredAt(dto.paidAt)
          : dto.paidAt === null
            ? null
            : undefined,
      }),
    );
    const activity = expenseActivityOnCreate(saved);
    if (activity) {
      await this.activityEvents.record({
        companyId,
        kind: activity.kind,
        entityType: 'expense',
        entityId: saved.id,
        subjectLabel: expenseActivitySubjectLabel(saved),
        title: activity.title,
        actor,
      });
    }
    return this.findOne(companyId, saved.id);
  }

  /** Gastos operativos automáticos tras crear una maniobra (control operativo asistido). */
  async createAutoExpensesForTrip(
    companyId: number,
    trip: Trip,
    options: {
      maintenanceProvisionPercent?: number;
      fuelPaymentMethod?: string;
      tollsPaymentMethod?: string;
      perDiemPaymentMethod?: string;
      controlPaymentMethod?: string;
    } = {},
    manager?: EntityManager,
  ): Promise<void> {
    const drafts = buildTripAutoExpenses(trip, options);
    if (drafts.length === 0) {
      return;
    }

    const repo = manager ? manager.getRepository(Expense) : this.repo;
    await repo.save(
      drafts.map((draft) =>
        repo.create({
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
          paymentMethod: draft.paymentMethod,
        }),
      ),
    );
  }

  async findAll(
    companyId: number,
    query?: ListExpensesQueryDto,
    options: { allowUnlimited?: boolean } = {},
  ): Promise<ExpensesListResult> {
    const limit =
      options.allowUnlimited === true && query?.limit === 0
        ? 0
        : normalizeExpenseListLimit(query?.limit);
    const page = Math.max(1, query?.page ?? 1);
    const tripFilter = await this.resolveExpenseListTripFilter(
      companyId,
      query,
    );

    const baseQb = this.repo.createQueryBuilder('e');
    applyExpenseListFilters(baseQb, companyId, query, tripFilter);

    const total = await baseQb.clone().getCount();

    const sumRow = await baseQb
      .clone()
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .getRawOne<{ sum: string }>();
    const totalAmount = sumRow?.sum ?? '0';

    const rowsQb = this.repo
      .createQueryBuilder('e')
      .leftJoin('e.trip', 'trip')
      .leftJoin('e.relatedUnit', 'relatedUnit')
      .leftJoin('e.relatedEquipment', 'relatedEquipment')
      .leftJoin('e.relatedOperator', 'relatedOperator')
      .addSelect([
        'e.id',
        'e.companyId',
        'e.tripId',
        'e.category',
        'e.amount',
        'e.currency',
        'e.incurredAt',
        'e.kind',
        'e.description',
        'e.vendor',
        'e.paymentMethod',
        'e.relatedUnitId',
        'e.relatedEquipmentId',
        'e.relatedOperatorId',
        'e.invoiceRequired',
        'e.paidAt',
        'e.createdAt',
        'e.updatedAt',
        'e.discardedAt',
      ])
      .addSelect(['trip.id', 'trip.maneuverCode'])
      .addSelect([
        'relatedUnit.id',
        'relatedUnit.trailerBrandAbbr',
        'relatedUnit.trailerYear',
        'relatedUnit.plate',
      ])
      .addSelect([
        'relatedEquipment.id',
        'relatedEquipment.trailerBrandAbbr',
        'relatedEquipment.trailerYear',
        'relatedEquipment.plate',
      ])
      .addSelect(['relatedOperator.id', 'relatedOperator.name']);
    applyExpenseListFilters(rowsQb, companyId, query, tripFilter);
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

    // Maniobras activas / completadas con saldo a operador (no historial completo).
    const tripsQb = this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoin('trip.unit', 'unit')
      .addSelect([
        'trip.id',
        'trip.companyId',
        'trip.status',
        'trip.maneuverCode',
        'trip.dieselAmount',
        'trip.casetasAmount',
        'trip.perDiemAmount',
        'trip.operatorQuota',
        'trip.unitId',
        'trip.operatorId',
        'trip.plannedDepartureAt',
        'trip.plannedCompletionAt',
        'trip.returnAt',
        'trip.completedAt',
        'trip.arrivedAt',
      ])
      .addSelect([
        'unit.id',
        'unit.trailerBrandAbbr',
        'unit.trailerYear',
        'unit.plate',
      ])
      .where('trip.companyId = :companyId', { companyId })
      .andWhere('trip.deleted_at IS NULL')
      .andWhere(
        `(
          trip.status IN ('scheduled', 'in_transit')
          OR (
            trip.status = 'completed'
            AND COALESCE(trip.operator_quota, 0) > 0
            AND COALESCE(trip.operator_quota, 0) > (
              SELECT COALESCE(SUM(pe.amount), 0)
              FROM ${this.repo.metadata.schema}.expenses pe
              WHERE pe.company_id = trip.company_id
                AND pe.trip_id = trip.id
                AND pe.discarded_at IS NULL
                AND pe.kind IN ('operator_payment', 'operator_commission')
            )
          )
        )`,
      );

    const [actualResult, trips, units, equipment] = await Promise.all([
      this.findAll(
        companyId,
        { from, to, limit: 0 },
        { allowUnlimited: true },
      ),
      tripsQb.getMany(),
      this.loadCalendarScheduleUnits(companyId),
      this.loadCalendarScheduleEquipment(companyId),
    ]);

    const operatorIds = [
      ...new Set(
        trips
          .map((t) => t.operatorId)
          .filter((id): id is number => id != null && id > 0),
      ),
    ];
    const operators =
      operatorIds.length > 0
        ? await this.operatorsRepo.find({
            where: { companyId, id: In(operatorIds) },
            select: ['id', 'name', 'paymentSchedule', 'paymentMethod'],
          })
        : [];

    const tripIds = trips.map((t) => t.id);
    const unitIds = units.map((u) => u.id);
    const equipmentIds = equipment.map((e) => e.id);

    const [
      tripDedupExpenses,
      verificationDedupExpenses,
      insuranceDedupExpenses,
      gpsDedupExpenses,
    ] = await Promise.all([
      tripIds.length > 0
        ? this.repo.find({
            where: {
              companyId,
              discardedAt: IsNull(),
              tripId: In(tripIds),
              kind: In([
                'fuel',
                'tolls',
                'per_diem',
                'operator_payment',
                'operator_commission',
              ]),
            },
            select: [
              'id',
              'tripId',
              'kind',
              'amount',
              'category',
              'description',
              'relatedUnitId',
              'relatedEquipmentId',
              'incurredAt',
              'discardedAt',
            ],
          })
        : Promise.resolve([] as Expense[]),
      this.repo
        .createQueryBuilder('e')
        .where('e.companyId = :companyId', { companyId })
        .andWhere('e.discarded_at IS NULL')
        .andWhere(`e.kind = 'verification'`)
        .andWhere(
          `(e.incurred_at AT TIME ZONE 'America/Mexico_City')::date BETWEEN :from::date AND :to::date`,
          { from, to },
        )
        .getMany(),
      unitIds.length > 0 || equipmentIds.length > 0
        ? this.repo
            .createQueryBuilder('e')
            .where('e.companyId = :companyId', { companyId })
            .andWhere('e.discarded_at IS NULL')
            .andWhere(`e.kind = 'insurance'`)
            .andWhere(
              `(
                (e.related_unit_id IS NOT NULL AND e.related_unit_id IN (:...unitIds))
                OR (e.related_equipment_id IS NOT NULL AND e.related_equipment_id IN (:...equipmentIds))
              )`,
              {
                unitIds: unitIds.length > 0 ? unitIds : [0],
                equipmentIds: equipmentIds.length > 0 ? equipmentIds : [0],
              },
            )
            .getMany()
        : Promise.resolve([] as Expense[]),
      unitIds.length > 0
        ? this.repo.find({
            where: {
              companyId,
              discardedAt: IsNull(),
              kind: 'gps',
              relatedUnitId: In(unitIds),
            },
          })
        : Promise.resolve([] as Expense[]),
    ]);
    const dedupExpenses = [
      ...tripDedupExpenses,
      ...verificationDedupExpenses,
      ...insuranceDedupExpenses,
      ...gpsDedupExpenses,
    ];

    const projection = buildExpenseCalendarProjection({
      from,
      to,
      trips,
      units,
      equipment,
      operators,
      tenures: [],
      expenses: dedupExpenses,
      actualItems: actualResult.items,
    });

    const paginated = paginateExpenseCalendarEntries(
      projection.entries,
      page,
      limit,
    );
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
        projectedTotalAmount: formatTotal(
          projection.summary.projectedTotalAmount,
        ),
        grandCount: projection.summary.grandCount,
        grandTotalAmount: formatTotal(projection.summary.grandTotalAmount),
      },
    };
  }

  /** Units con schedule de GPS, seguro o entradas de verificación. */
  private async loadCalendarScheduleUnits(companyId: number): Promise<Unit[]> {
    return this.unitsRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.fleetProfile', 'fp')
      .leftJoinAndSelect('u.verificationEntries', 've')
      .where('u.companyId = :companyId', { companyId })
      .andWhere(
        `(
          EXISTS (
            SELECT 1 FROM ${this.unitsRepo.metadata.schema}.unit_fleet_profiles p
            WHERE p.unit_id = u.id
              AND (
                (p.has_gps = true AND COALESCE(p.gps_price, 0) > 0)
                OR COALESCE(p.insurance_cost, 0) > 0
              )
          )
          OR EXISTS (
            SELECT 1 FROM ${this.unitsRepo.metadata.schema}.fleet_verification_entries v
            WHERE v.unit_id = u.id
              AND v.entry_date IS NOT NULL
              AND COALESCE(v.cost, 0) > 0
          )
        )`,
      )
      .getMany();
  }

  /** Equipment con schedule de seguro o verificación. */
  private async loadCalendarScheduleEquipment(
    companyId: number,
  ): Promise<Equipment[]> {
    return this.equipmentRepo
      .createQueryBuilder('eq')
      .leftJoinAndSelect('eq.fleetProfile', 'fp')
      .leftJoinAndSelect('eq.verificationEntries', 've')
      .where('eq.companyId = :companyId', { companyId })
      .andWhere(
        `(
          EXISTS (
            SELECT 1 FROM ${this.equipmentRepo.metadata.schema}.equipment_fleet_profiles p
            WHERE p.equipment_id = eq.id
              AND COALESCE(p.insurance_cost, 0) > 0
          )
          OR EXISTS (
            SELECT 1 FROM ${this.equipmentRepo.metadata.schema}.fleet_verification_entries v
            WHERE v.equipment_id = eq.id
              AND v.entry_date IS NOT NULL
              AND COALESCE(v.cost, 0) > 0
          )
        )`,
      )
      .getMany();
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

  async hasFleetTenureExpenseWithDescription(
    companyId: number,
    params: {
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
      .andWhere('e.kind = :kind', { kind: 'tenure_payment' })
      .andWhere('e.discardedAt IS NULL')
      .andWhere('e.description = :description', { description });
    if (params.relatedUnitId != null) {
      qb.andWhere('e.relatedUnitId = :relatedUnitId', {
        relatedUnitId: params.relatedUnitId,
      });
    }
    if (params.relatedEquipmentId != null) {
      qb.andWhere('e.relatedEquipmentId = :relatedEquipmentId', {
        relatedEquipmentId: params.relatedEquipmentId,
      });
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

  /** Transacción sobre la conexión de gastos (para discard+recreate atómico). */
  runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.repo.manager.transaction(fn);
  }

  async findScheduledExpenses(
    companyId: number,
    kind: string,
    params: {
      relatedUnitId?: number;
      relatedEquipmentId?: number;
      insuranceTarget?: 'unit' | 'equipment';
    },
    manager?: EntityManager,
  ): Promise<Expense[]> {
    const repo = manager ? manager.getRepository(Expense) : this.repo;
    const qb = repo
      .createQueryBuilder('e')
      .where('e.companyId = :companyId', { companyId })
      .andWhere('e.kind = :kind', { kind })
      .andWhere('e.discardedAt IS NULL');
    if (params.insuranceTarget === 'unit' && params.relatedUnitId != null) {
      qb.andWhere('e.relatedUnitId = :uid', { uid: params.relatedUnitId });
    } else if (
      params.insuranceTarget === 'equipment' &&
      params.relatedEquipmentId != null
    ) {
      qb.andWhere('e.relatedEquipmentId = :eid', {
        eid: params.relatedEquipmentId,
      });
    } else {
      if (params.relatedUnitId != null) {
        qb.andWhere('e.relatedUnitId = :uid', { uid: params.relatedUnitId });
      }
      if (params.relatedEquipmentId != null) {
        qb.andWhere('e.relatedEquipmentId = :eid', {
          eid: params.relatedEquipmentId,
        });
      }
    }
    return qb.orderBy('e.incurredAt', 'ASC').getMany();
  }

  async discardUnpaidScheduledExpenses(
    companyId: number,
    kind: string,
    params: {
      relatedUnitId?: number;
      relatedEquipmentId?: number;
      insuranceTarget?: 'unit' | 'equipment';
    },
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager ? manager.getRepository(Expense) : this.repo;
    const existing = await this.findScheduledExpenses(
      companyId,
      kind,
      params,
      manager,
    );
    const unpaidIds = existing.filter((e) => e.paidAt == null).map((e) => e.id);
    if (unpaidIds.length === 0) return 0;
    const result = await repo
      .createQueryBuilder()
      .update(Expense)
      .set({ discardedAt: new Date() })
      .whereInIds(unpaidIds)
      .execute();
    return result.affected ?? 0;
  }

  async bulkCreateScheduledExpenses(
    companyId: number,
    drafts: Array<CreateExpenseDto & { paidAt?: string | null }>,
    manager?: EntityManager,
  ): Promise<void> {
    if (drafts.length === 0) return;
    const repo = manager ? manager.getRepository(Expense) : this.repo;
    const entities = await Promise.all(
      drafts.map(async (dto) => {
        const relatedUnitId = dto.relatedUnitId
          ? await this.resolveUnitId(companyId, dto.relatedUnitId)
          : undefined;
        const relatedEquipmentId = dto.relatedEquipmentId
          ? await this.resolveEquipmentId(companyId, dto.relatedEquipmentId)
          : undefined;
        const relationFields = normalizeExpenseRelationFields({
          kind: dto.kind,
          verificationScope: dto.verificationScope,
          category: dto.category,
          relatedUnitId: relatedUnitId ?? null,
          relatedEquipmentId: relatedEquipmentId ?? null,
        });
        return repo.create({
          companyId,
          category: relationFields.category ?? dto.category,
          amount: String(dto.amount),
          currency: dto.currency ?? 'MXN',
          incurredAt: parseOperationalIncurredAt(dto.incurredAt),
          kind: dto.kind,
          relatedUnitId,
          relatedEquipmentId,
          description: dto.description?.trim() || relationFields.descriptionHint,
          vendor: expenseTextColumn(dto.vendor),
          paymentMethod: expenseTextColumn(dto.paymentMethod),
          invoiceRequired: dto.invoiceRequired ?? false,
          paidAt: dto.paidAt ? parseOperationalIncurredAt(dto.paidAt) : null,
        });
      }),
    );
    await repo.save(entities);
  }

  /**
   * Descarta gastos vinculados a una maniobra eliminada (soft delete operativo).
   * Acepta un EntityManager para participar en la transacción de la eliminación.
   */
  async discardByTripId(
    companyId: number,
    tripId: number,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager ? manager.getRepository(Expense) : this.repo;
    const result = await repo
      .createQueryBuilder()
      .update(Expense)
      .set({ discardedAt: new Date() })
      .where('company_id = :companyId', { companyId })
      .andWhere('trip_id = :tripId', { tripId })
      .andWhere('discarded_at IS NULL')
      .execute();
    return result.affected ?? 0;
  }

  async update(
    companyId: number,
    expenseId: number,
    dto: UpdateExpenseDto,
    actor?: AuthUser,
  ) {
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
      verificationScope,
      kind,
      category,
      description,
      paidAt,
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
        { kind, verificationScope, category },
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
      ...(category !== undefined || relationFields.category
        ? { category: relationFields.category ?? category ?? existing.category }
        : {}),
      ...(description !== undefined || relationFields.descriptionHint
        ? {
            description:
              description?.trim() ||
              relationFields.descriptionHint ||
              existing.description,
          }
        : {}),
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
      ...(paidAt !== undefined && {
        paidAt: paidAt ? parseOperationalIncurredAt(paidAt) : null,
      }),
    } as Parameters<Repository<Expense>['update']>[1]);
    const updated = await this.repo.findOne({
      where: { companyId, id: expenseId },
    });
    if (updated) {
      const activity = expenseActivityOnUpdate(updated, existing);
      if (activity) {
        await this.activityEvents.record({
          companyId,
          kind: activity.kind,
          entityType: 'expense',
          entityId: updated.id,
          subjectLabel: expenseActivitySubjectLabel(updated),
          title: activity.title,
          actor,
          metadata: {
            expenseKind: updated.kind,
            amount: Number(updated.amount ?? 0),
            paidAt: updated.paidAt?.toISOString() ?? null,
          },
        });
      }
    }
    return this.findOne(companyId, expenseId);
  }

  async remove(companyId: number, expenseId: number, actor: AuthUser) {
    if (!isAdminRole(actor.role)) {
      throw new ForbiddenException(
        'Solo administradores pueden eliminar gastos.',
      );
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
    await this.insuranceFleetReconcile.reconcileAfterGpsExpenseDiscard(
      existing,
    );
    await this.verificationFleetReconcile.reconcileAfterVerificationExpenseDiscard(
      existing,
    );
    return { id: expenseId, deleted: true };
  }

  private async resolveExpenseListTripFilter(
    companyId: number,
    query?: ListExpensesQueryDto,
  ): Promise<{ tripIds?: number[] } | undefined> {
    const tripId = query?.tripId?.trim();
    if (tripId) {
      return { tripIds: [await this.resolveTripId(companyId, tripId)] };
    }

    const tripIdsRaw = query?.tripIds?.trim();
    if (!tripIdsRaw) {
      return undefined;
    }

    const refs = tripIdsRaw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (refs.length === 0) {
      return { tripIds: [] };
    }

    return {
      tripIds: await Promise.all(
        refs.map((ref) => this.resolveTripId(companyId, ref)),
      ),
    };
  }

  private async resolveTripId(companyId: number, ref: string): Promise<number> {
    const tripId = parseOptionalNumericId(ref, 'Trip')!;
    const row = await this.tripsRepo.findOne({
      where: { companyId, id: tripId, deletedAt: IsNull() },
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
