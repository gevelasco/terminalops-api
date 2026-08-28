import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, type EntityManager } from 'typeorm';
import { isAdminRole } from 'src/common/constants/app-modules';
import { FileService } from 'src/common/file/file.service';
import { serializeExpense } from 'src/common/serializers/expense.serializer';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import type AuthUser from 'src/types/auth-user.type';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { ExpenseDocument } from 'src/expenses/entities/expense-document.entity';
import {
  expenseTextColumn,
  isExpenseVerificationScope,
  mergeExpenseRelationForNormalize,
  normalizeExpenseRelationFields,
  verificationScopeFromExpenseText,
} from 'src/expenses/expense-payload.util';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import {
  CreateExpenseDocumentDto,
  CreateExpenseDto,
} from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { ExpensesCalendarQueryDto } from './dto/expenses-calendar-query.dto';
import {
  applyExpenseListFilters,
  normalizeExpenseListLimit,
} from './expenses-list.util';
import {
  assertExpenseCalendarDateRange,
  EXPENSE_CALENDAR_ACTUAL_MAX_ROWS,
} from './expenses-calendar-range.util';
import {
  actualEntryFromSerialized,
  buildLedgerCalendar,
  type ExpenseCalendarEntry,
  type ExpenseCalendarMarker,
} from './expenses-calendar-projection.util';
import { applyScheduledExpenseAssetFilter } from './expenses-scheduled-asset-filter.util';
import { applyUnpaidScheduledLedgerRange } from './unpaid-scheduled-ledger.query';
import { buildTripAutoExpenses } from 'src/trips/trip-auto-expenses.util';
import { VERIFICATION_RENEWAL_MONTHS } from 'src/fleet/fleet-verification-expense-sync.util';
import {
  addOperationalMonthsYmd,
  formatOperationalIncurredDateYmd,
  parseOperationalIncurredAt,
} from './expenses-incurred-at.util';
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
import {
  EXPENSE_DOCUMENT_SLOTS,
  EXPENSE_DOCUMENT_STORAGE_FOLDER,
  type ExpenseDocumentSlot,
} from './expense-document.constants';

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
    grandCount: number;
    grandTotalAmount: string;
  };
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly repo: Repository<Expense>,
    @InjectRepository(ExpenseDocument)
    private readonly documentsRepo: Repository<ExpenseDocument>,
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
    private readonly fileService: FileService,
  ) {}

  async create(companyId: number, dto: CreateExpenseDto, actor?: AuthUser) {
    const { documents, ...expenseDto } = dto;
    const relatedUnitId = expenseDto.relatedUnitId
      ? await this.resolveUnitId(companyId, expenseDto.relatedUnitId)
      : undefined;
    const relatedEquipmentId = expenseDto.relatedEquipmentId
      ? await this.resolveEquipmentId(companyId, expenseDto.relatedEquipmentId)
      : undefined;
    const relationFields = normalizeExpenseRelationFields({
      kind: expenseDto.kind,
      verificationScope: expenseDto.verificationScope,
      category: expenseDto.category,
      relatedUnitId: relatedUnitId ?? null,
      relatedEquipmentId: relatedEquipmentId ?? null,
    });

    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        category: relationFields.category ?? expenseDto.category,
        amount: String(expenseDto.amount),
        currency: expenseDto.currency ?? 'MXN',
        incurredAt: parseOperationalIncurredAt(expenseDto.incurredAt),
        kind: expenseDto.kind,
        tripId: expenseDto.tripId
          ? await this.resolveTripId(companyId, expenseDto.tripId)
          : undefined,
        relatedUnitId,
        relatedEquipmentId,
        relatedOperatorId: expenseDto.relatedOperatorId
          ? await this.resolveOperatorId(companyId, expenseDto.relatedOperatorId)
          : undefined,
        description:
          expenseDto.description?.trim() || relationFields.descriptionHint,
        vendor: expenseTextColumn(expenseDto.vendor),
        paymentMethod: expenseTextColumn(expenseDto.paymentMethod),
        invoiceRequired: expenseDto.invoiceRequired ?? false,
        paidAt: expenseDto.paidAt
          ? parseOperationalIncurredAt(expenseDto.paidAt)
          : expenseDto.paidAt === null
            ? null
            : undefined,
      }),
    );
    if (documents !== undefined) {
      await this.replaceExpenseDocuments(saved.id, documents);
    }
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
    await this.syncNextVerificationInstallment(saved);
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
          ...(draft.paidAt !== undefined ? { paidAt: draft.paidAt } : {}),
        }),
      ),
    );
  }

  async findAll(
    companyId: number,
    query?: ListExpensesQueryDto,
    options: {
      /** Default false — documentos solo en GET /expenses/:id. */
      includeDocuments?: boolean;
      skipAggregates?: boolean;
    } = {},
  ): Promise<ExpensesListResult> {
    const limit = normalizeExpenseListLimit(query?.limit);
    const page = Math.max(1, query?.page ?? 1);
    const includeDocuments = options.includeDocuments === true;
    const skipAggregates = options.skipAggregates === true;
    const tripFilter = await this.resolveExpenseListTripFilter(
      companyId,
      query,
    );

    const baseQb = this.repo.createQueryBuilder('e');
    applyExpenseListFilters(baseQb, companyId, query, tripFilter);

    let total = 0;
    let totalAmount = '0';
    if (!skipAggregates) {
      total = await baseQb.clone().getCount();
      const sumRow = await baseQb
        .clone()
        .select('COALESCE(SUM(e.amount), 0)', 'sum')
        .getRawOne<{ sum: string }>();
      totalAmount = sumRow?.sum ?? '0';
    }

    // select() for `e` (not addSelect): avoid duplicate aliases with skip/take DISTINCT.
    const rowsQb = this.repo
      .createQueryBuilder('e')
      .select([
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
      .leftJoin('e.trip', 'trip')
      .leftJoin('e.relatedUnit', 'relatedUnit')
      .leftJoin('e.relatedEquipment', 'relatedEquipment')
      .leftJoin('e.relatedOperator', 'relatedOperator')
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
    rowsQb.skip((page - 1) * limit).take(limit);

    const rows = await rowsQb.getMany();
    if (includeDocuments) {
      await this.attachDocuments(rows);
    } else {
      for (const row of rows) {
        row.documents = [];
      }
    }

    if (skipAggregates) {
      total = rows.length;
    }

    return {
      items: rows.map((row) => serializeExpense(row)),
      total,
      page,
      limit,
      totalAmount,
    };
  }

  async getCalendar(
    companyId: number,
    query: ExpensesCalendarQueryDto,
  ): Promise<ExpensesCalendarResult> {
    const { from, to } = assertExpenseCalendarDateRange(query.from, query.to);
    const formatTotal = (value: number) => value.toFixed(2);

    if (query.all === true) {
      const actualItems = await this.loadCalendarActualExpenses(companyId, from, to);
      return this.toLedgerCalendarResult(from, to, actualItems, {
        page: 1,
        limit: actualItems.length,
        total: actualItems.length,
      });
    }

    const limit = normalizeExpenseListLimit(query.limit);
    const page = Math.max(1, query.page ?? 1);
    const [list, markerFacts] = await Promise.all([
      this.findAll(companyId, { from, to, page, limit }),
      this.loadCalendarMarkerFacts(companyId, from, to),
    ]);
    const view = buildLedgerCalendar(markerFacts);
    const expenseById = new Map(
      list.items.map((item) => [Number(item['id']), item]),
    );
    const items: ExpensesCalendarItem[] = list.items.map((row) => {
      const entry = actualEntryFromSerialized(row);
      return {
        ...entry,
        expense:
          entry.expenseId != null ? expenseById.get(entry.expenseId) : undefined,
      };
    });
    return {
      from,
      to,
      items,
      total: list.total,
      page: list.page,
      limit: list.limit,
      markers: view.markers,
      summary: {
        actualCount: view.summary.actualCount,
        actualTotalAmount: formatTotal(view.summary.actualTotalAmount),
        grandCount: view.summary.grandCount,
        grandTotalAmount: formatTotal(view.summary.grandTotalAmount),
      },
    };
  }

  private toLedgerCalendarResult(
    from: string,
    to: string,
    actualItems: ReturnType<typeof serializeExpense>[],
    paging: { page: number; limit: number; total: number },
  ): ExpensesCalendarResult {
    const view = buildLedgerCalendar(actualItems);
    const expenseById = new Map(
      actualItems.map((item) => [Number(item['id']), item]),
    );
    const items: ExpensesCalendarItem[] = view.entries.map((entry) => ({
      ...entry,
      expense:
        entry.expenseId != null ? expenseById.get(entry.expenseId) : undefined,
    }));
    const formatTotal = (value: number) => value.toFixed(2);
    return {
      from,
      to,
      items,
      total: paging.total,
      page: paging.page,
      limit: paging.limit,
      markers: view.markers,
      summary: {
        actualCount: view.summary.actualCount,
        actualTotalAmount: formatTotal(view.summary.actualTotalAmount),
        grandCount: view.summary.grandCount,
        grandTotalAmount: formatTotal(view.summary.grandTotalAmount),
      },
    };
  }

  /**
   * Hechos mínimos del mes para marcadores/totales (sin joins de flota).
   */
  private async loadCalendarMarkerFacts(
    companyId: number,
    from: string,
    to: string,
  ): Promise<ReturnType<typeof serializeExpense>[]> {
    const qb = this.repo
      .createQueryBuilder('e')
      .select([
        'e.id',
        'e.kind',
        'e.amount',
        'e.currency',
        'e.paidAt',
        'e.tripId',
        'e.incurredAt',
        'e.category',
      ]);
    applyExpenseListFilters(qb, companyId, { from, to });
    const rows = await qb.getMany();
    return rows.map((row) => serializeExpense(row));
  }

  /**
   * Solo cuotas programadas pendientes del ledger (notificaciones).
   * No usa el calendario completo: pagados y eventuales no aplican.
   */
  async getPaymentDueItemsForNotifications(
    companyId: number,
    from: string,
    to: string,
  ): Promise<{ items: ExpenseCalendarEntry[] }> {
    const rows = await applyUnpaidScheduledLedgerRange(
      this.repo
        .createQueryBuilder('e')
        .where('e.companyId = :companyId', { companyId }),
      { from, to },
    ).getMany();
    return {
      items: rows.map((row) => actualEntryFromSerialized(serializeExpense(row))),
    };
  }

  /** Gastos del periodo para `all=true` (sin docs; con tope). */
  private async loadCalendarActualExpenses(
    companyId: number,
    from: string,
    to: string,
  ): Promise<ReturnType<typeof serializeExpense>[]> {
    const items: ReturnType<typeof serializeExpense>[] = [];
    const pageSize = 100;
    let page = 1;
    for (;;) {
      const batch = await this.findAll(
        companyId,
        { from, to, page, limit: pageSize },
        { includeDocuments: false, skipAggregates: true },
      );
      items.push(...batch.items);
      if (items.length > EXPENSE_CALENDAR_ACTUAL_MAX_ROWS) {
        throw new BadRequestException(
          `Demasiados gastos en el rango (máximo ${EXPENSE_CALENDAR_ACTUAL_MAX_ROWS}). Reduce el periodo.`,
        );
      }
      if (batch.items.length < pageSize) {
        break;
      }
      page += 1;
    }
    return items;
  }

  async findOne(companyId: number, expenseId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: expenseId, discardedAt: IsNull() },
      relations: [
        'trip',
        'relatedUnit',
        'relatedEquipment',
        'relatedOperator',
        'documents',
      ],
      order: { documents: { sortOrder: 'ASC' } },
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
    applyScheduledExpenseAssetFilter(qb, params);
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

  async findActiveVerificationOnDate(params: {
    companyId: number;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    scope: string;
    incurredYmd: string;
  }): Promise<Expense | null> {
    const rows = await this.findScheduledExpenses(params.companyId, 'verification', {
      relatedUnitId: params.relatedUnitId,
      relatedEquipmentId: params.relatedEquipmentId,
    });
    return (
      rows.find((row) => {
        const scope = verificationScopeFromExpenseText(row.category, row.description);
        return (
          scope === params.scope &&
          formatOperationalIncurredDateYmd(row.incurredAt) === params.incurredYmd
        );
      }) ?? null
    );
  }

  async ensureNextVerificationInstallment(params: {
    companyId: number;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    scope: string;
    lastVerificationYmd: string;
    amount: number;
    category: string;
    description?: string | null;
  }): Promise<void> {
    if (!isExpenseVerificationScope(params.scope) || params.amount <= 0) {
      return;
    }
    const nextYmd = addOperationalMonthsYmd(
      params.lastVerificationYmd,
      VERIFICATION_RENEWAL_MONTHS,
    );
    if (!nextYmd || nextYmd === params.lastVerificationYmd) {
      return;
    }
    const existing = await this.findScheduledExpenses(params.companyId, 'verification', {
      relatedUnitId: params.relatedUnitId,
      relatedEquipmentId: params.relatedEquipmentId,
    });
    const scoped = existing.filter(
      (row) =>
        verificationScopeFromExpenseText(row.category, row.description) ===
        params.scope,
    );
    const staleUnpaid = scoped.filter((row) => {
      if (row.paidAt != null) {
        return false;
      }
      const ymd = formatOperationalIncurredDateYmd(row.incurredAt);
      return ymd > params.lastVerificationYmd && ymd !== nextYmd;
    });
    if (staleUnpaid.length > 0) {
      await this.repo
        .createQueryBuilder()
        .update(Expense)
        .set({ discardedAt: new Date() })
        .whereInIds(staleUnpaid.map((row) => row.id))
        .execute();
    }
    const atNext = scoped.find(
      (row) => formatOperationalIncurredDateYmd(row.incurredAt) === nextYmd,
    );
    if (atNext) {
      if (atNext.paidAt == null && Number(atNext.amount) !== params.amount) {
        atNext.amount = String(params.amount);
        await this.repo.save(atNext);
      }
      return;
    }
    await this.bulkCreateScheduledExpenses(params.companyId, [
      {
        category: params.category,
        amount: params.amount,
        incurredAt: nextYmd,
        kind: 'verification',
        verificationScope: params.scope,
        relatedUnitId:
          params.relatedUnitId != null ? String(params.relatedUnitId) : undefined,
        relatedEquipmentId:
          params.relatedEquipmentId != null
            ? String(params.relatedEquipmentId)
            : undefined,
        description: params.description?.trim() || undefined,
        paidAt: null,
      },
    ]);
  }

  private async syncNextVerificationInstallment(expense: Expense): Promise<void> {
    if (expense.kind !== 'verification' || expense.discardedAt) {
      return;
    }
    const scope = verificationScopeFromExpenseText(
      expense.category,
      expense.description,
    );
    if (!scope) {
      return;
    }
    if (expense.relatedUnitId == null && expense.relatedEquipmentId == null) {
      return;
    }
    await this.ensureNextVerificationInstallment({
      companyId: expense.companyId,
      relatedUnitId: expense.relatedUnitId,
      relatedEquipmentId: expense.relatedEquipmentId,
      scope,
      lastVerificationYmd: formatOperationalIncurredDateYmd(expense.incurredAt),
      amount: Number(expense.amount) || 0,
      category: expense.category,
      description: expense.description,
    });
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
      documents,
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
    if (documents !== undefined) {
      await this.replaceExpenseDocuments(expenseId, documents);
    }
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
    if (updated) {
      await this.syncNextVerificationInstallment(updated);
    }
    return this.findOne(companyId, expenseId);
  }

  private async attachDocuments(rows: Expense[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    const docs = await this.documentsRepo.find({
      where: { expenseId: In(rows.map((r) => r.id)) },
      order: { sortOrder: 'ASC' },
    });
    const byExpense = new Map<number, ExpenseDocument[]>();
    for (const doc of docs) {
      const list = byExpense.get(doc.expenseId) ?? [];
      list.push(doc);
      byExpense.set(doc.expenseId, list);
    }
    for (const row of rows) {
      row.documents = byExpense.get(row.id) ?? [];
    }
  }

  private async replaceExpenseDocuments(
    expenseId: number,
    documents: CreateExpenseDocumentDto[],
  ): Promise<void> {
    // Prefer POST/DELETE /expenses/:id/documents for binary files.
    // Nested documents[] remains for legacy metadata sync and preserves storage_key.
    const previous = await this.documentsRepo.find({ where: { expenseId } });
    const previousById = new Map(previous.map((d) => [d.id, d]));
    const keptIds = new Set<number>();

    const nextRows = await Promise.all(
      documents.map(async (doc, index) => {
        const existingDocId = await this.resolveDocumentId(expenseId, doc.id);
        const previousRow = existingDocId
          ? previousById.get(existingDocId)
          : undefined;
        if (existingDocId) {
          keptIds.add(existingDocId);
        }
        return this.documentsRepo.create({
          ...(existingDocId ? { id: existingDocId } : {}),
          expenseId,
          fileName: doc.fileName,
          slot: doc.slot,
          addedAt: doc.addedAt ?? new Date().toISOString().slice(0, 10),
          sortOrder: index,
          storageKey: previousRow?.storageKey ?? null,
          contentType: previousRow?.contentType ?? null,
          sizeBytes: previousRow?.sizeBytes ?? null,
        });
      }),
    );

    for (const row of previous) {
      if (keptIds.has(row.id)) {
        continue;
      }
      if (row.storageKey) {
        await this.fileService.remove(row.storageKey);
      }
    }

    await this.documentsRepo.delete({ expenseId });
    if (nextRows.length > 0) {
      await this.documentsRepo.save(nextRows);
    }
  }

  async uploadDocument(
    companyId: number,
    expenseId: number,
    slot: ExpenseDocumentSlot,
    file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (!(EXPENSE_DOCUMENT_SLOTS as readonly string[]).includes(slot)) {
      throw new BadRequestException('Invalid slot');
    }
    await this.assertExpenseExists(companyId, expenseId);

    const uploaded = await this.fileService.upload(
      EXPENSE_DOCUMENT_STORAGE_FOLDER,
      file,
    );
    const maxSort = await this.documentsRepo
      .createQueryBuilder('d')
      .select('MAX(d.sort_order)', 'max')
      .where('d.expense_id = :expenseId', { expenseId })
      .getRawOne<{ max: string | null }>();
    const sortOrder = Number(maxSort?.max ?? -1) + 1;

    const saved = await this.documentsRepo.save(
      this.documentsRepo.create({
        expenseId,
        slot,
        fileName: uploaded.originalName,
        storageKey: uploaded.url,
        contentType: file.mimetype || null,
        sizeBytes: String(file.size),
        addedAt: new Date().toISOString().slice(0, 10),
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      }),
    );

    return {
      id: saved.id,
      expenseId: saved.expenseId,
      slot: saved.slot,
      fileName: saved.fileName,
      addedAt: saved.addedAt,
      sortOrder: saved.sortOrder,
      hasStoredFile: true,
    };
  }

  async downloadDocument(
    companyId: number,
    expenseId: number,
    documentId: number,
  ) {
    const document = await this.findDocumentForExpense(
      companyId,
      expenseId,
      documentId,
    );
    if (!document.storageKey) {
      throw new NotFoundException(
        `Document ${documentId} has no stored file`,
      );
    }
    return this.fileService.presignedUrl(document.storageKey);
  }

  async removeDocument(
    companyId: number,
    expenseId: number,
    documentId: number,
  ) {
    const document = await this.findDocumentForExpense(
      companyId,
      expenseId,
      documentId,
    );
    if (document.storageKey) {
      await this.fileService.remove(document.storageKey);
    }
    await this.documentsRepo.delete({ id: documentId, expenseId });
    return { id: documentId, deleted: true };
  }

  private async assertExpenseExists(
    companyId: number,
    expenseId: number,
  ): Promise<void> {
    const row = await this.repo.findOne({
      where: { companyId, id: expenseId },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Expense ${expenseId} not found`);
    }
  }

  private async findDocumentForExpense(
    companyId: number,
    expenseId: number,
    documentId: number,
  ): Promise<ExpenseDocument> {
    await this.assertExpenseExists(companyId, expenseId);
    const document = await this.documentsRepo.findOne({
      where: { id: documentId, expenseId },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    return document;
  }

  private async resolveDocumentId(
    expenseId: number,
    ref?: string | number,
  ): Promise<number | undefined> {
    if (ref == null || ref === '') {
      return undefined;
    }
    const id = typeof ref === 'number' ? ref : Number(ref);
    if (!Number.isInteger(id) || id < 1) {
      return undefined;
    }
    const row = await this.documentsRepo.findOne({
      where: { expenseId, id },
      select: ['id'],
    });
    return row?.id;
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
