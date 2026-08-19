import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { FileService } from 'src/common/file/file.service';
import { serializeOperator } from 'src/common/serializers/operator.serializer';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import {
  buildNextPayDueByOperatorId,
  buildOperatorLastManeuverSnapshot,
} from 'src/operators/operator-list-enrichment.util';
import {
  buildOperatorOperationSummary,
  OPERATOR_SUMMARY_RECENT_DAYS,
} from 'src/operators/operator-operation-summary.util';
import { tripCompletionAnchorYmd } from 'src/operators/operator-payment-schedule.util';
import { parseOperationalIncurredAt } from 'src/expenses/expenses-incurred-at.util';
import { expenseTextColumn } from 'src/expenses/expense-payload.util';
import { Operator } from 'src/operators/entities/operator.entity';
import { OperatorDocument } from 'src/operators/entities/operator-document.entity';
import { OperatorEmergencyContact } from 'src/operators/entities/operator-emergency-contact.entity';
import { OperatorPrivateInsurance } from 'src/operators/entities/operator-private-insurance.entity';
import { OperatorPublicInsurance } from 'src/operators/entities/operator-public-insurance.entity';
import { CreateOperatorDto } from './dto/create-operator.dto';
import type { OperatorOperationSummaryDto } from './dto/operator-operation-summary.dto';
import { UpdateOperatorDto } from './dto/update-operator.dto';
import {
  OPERATOR_DOCUMENT_SLOTS,
  OPERATOR_DOCUMENT_STORAGE_FOLDER,
  type OperatorDocumentSlot,
} from './operator-document.constants';
import {
  ListResourcePageQueryDto,
  normalizeResourceListLimit,
  normalizeResourceListPage,
  toResourceListResult,
  type ResourceListResult,
} from 'src/common/dto/list-resource-page-query.dto';
import { pickOperatorUserMutableFields } from 'src/fleet/fleet-resource-user-patch.util';
import {
  FLEET_ASSIGNABLE_LIST_STATUS,
  type FleetListAvailableOptions,
} from 'src/fleet/fleet-available-list.util';
import { rejectClientFleetStatusMutation } from 'src/fleet/fleet-status-lock.util';
import type { ListResourceLinkOptionsQueryDto } from 'src/common/dto/list-resource-link-options-query.dto';
import { isFleetLinkOptionsSearchAllowed } from 'src/fleet/fleet-link-options-search.util';
import { mapOperatorLinkOption } from './operator-link-option.mapper';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import { COMPANY_ACTIVITY_KIND } from 'src/activity-events/company-activity-event.kinds';
import type AuthUser from 'src/types/auth-user.type';
import {
  OperatorHrHoldWorkflowService,
  type OperatorHrHoldStatus,
} from './operator-hr-hold-workflow.service';

export type OperatorsFindAllOptions = FleetListAvailableOptions &
  ListResourcePageQueryDto;

export type OperatorsListResult = ResourceListResult<
  ReturnType<typeof serializeOperator>
>;

const OPERATOR_RELATIONS = [
  'emergencyContact',
  'publicInsurance',
  'privateInsurance',
  'documents',
] as const;

type OperatorNestedPayload = Pick<
  CreateOperatorDto,
  'emergencyContact' | 'publicInsurance' | 'privateInsurance' | 'documents'
>;

@Injectable()
export class OperatorsService {
  constructor(
    @InjectRepository(Operator)
    private readonly repo: Repository<Operator>,
    @InjectRepository(OperatorEmergencyContact)
    private readonly emergencyRepo: Repository<OperatorEmergencyContact>,
    @InjectRepository(OperatorPublicInsurance)
    private readonly publicInsuranceRepo: Repository<OperatorPublicInsurance>,
    @InjectRepository(OperatorPrivateInsurance)
    private readonly privateInsuranceRepo: Repository<OperatorPrivateInsurance>,
    @InjectRepository(OperatorDocument)
    private readonly documentsRepo: Repository<OperatorDocument>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    private readonly fileService: FileService,
    private readonly activityEvents: ActivityEventsService,
    private readonly hrHoldWorkflow: OperatorHrHoldWorkflowService,
  ) {}

  async create(companyId: number, dto: CreateOperatorDto) {
    rejectClientFleetStatusMutation(dto as unknown as Record<string, unknown>);
    const core = this.extractCoreFields(dto);
    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        status: 'available',
        ...core,
      }),
    );
    await this.saveNested(saved.id, dto);
    return this.findOne(companyId, saved.id);
  }

  async findAll(
    companyId: number,
    options?: OperatorsFindAllOptions,
  ): Promise<OperatorsListResult> {
    const limit = normalizeResourceListLimit(options?.limit);
    const page = normalizeResourceListPage(options?.page);

    const countQb = this.repo
      .createQueryBuilder('operator')
      .where('operator.companyId = :companyId', { companyId });

    if (options?.available) {
      countQb
        .andWhere('operator.isActive = :isActive', { isActive: true })
        .andWhere('operator.status = :status', {
          status: FLEET_ASSIGNABLE_LIST_STATUS,
        });
    } else {
      countQb.andWhere('operator.isActive = :isActive', { isActive: true });
    }

    const total = await countQb.getCount();

    const qb = this.repo
      .createQueryBuilder('operator')
      .leftJoinAndSelect('operator.emergencyContact', 'emergencyContact')
      .leftJoinAndSelect('operator.publicInsurance', 'publicInsurance')
      .leftJoinAndSelect('operator.privateInsurance', 'privateInsurance')
      .leftJoinAndSelect('operator.documents', 'documents')
      .loadRelationCountAndMap(
        'operator.maneuverCount',
        'operator.trips',
        'trip',
        (qb) => qb.andWhere('trip.deleted_at IS NULL'),
      )
      .where('operator.companyId = :companyId', { companyId });

    if (options?.available) {
      qb.andWhere('operator.isActive = :isActive', { isActive: true }).andWhere(
        'operator.status = :status',
        { status: FLEET_ASSIGNABLE_LIST_STATUS },
      );
    } else {
      qb.andWhere('operator.isActive = :isActive', { isActive: true });
    }

    qb.orderBy('operator.name', 'ASC').addOrderBy('documents.sortOrder', 'ASC');
    if (limit > 0) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const rows = await qb.getMany();

    if (!options?.available) {
      await this.applyListMetrics(companyId, rows);
    }
    return toResourceListResult(
      rows.map((row) => serializeOperator(row, { list: true })),
      total,
      page,
      limit,
    );
  }

  async findLinkOptions(
    companyId: number,
    query: ListResourceLinkOptionsQueryDto = {},
  ) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const idRaw = query.id?.trim();
    if (idRaw) {
      const id = Number(idRaw);
      if (Number.isFinite(id) && id > 0) {
        const row = await this.repo.findOne({ where: { companyId, id } });
        return { items: row ? [mapOperatorLinkOption(row)] : [] };
      }
      return { items: [] };
    }

    const search = query.search?.trim();
    if (!isFleetLinkOptionsSearchAllowed(search)) {
      return { items: [] };
    }

    const rows = await this.repo
      .createQueryBuilder('operator')
      .select([
        'operator.id',
        'operator.name',
        'operator.status',
        'operator.isActive',
      ])
      .where('operator.companyId = :companyId', { companyId })
      .andWhere('operator.isActive = :isActive', { isActive: true })
      .andWhere(
        `(
          operator.name ILIKE :q OR
          operator.license_number ILIKE :q OR
          CAST(operator.id AS TEXT) ILIKE :q
        )`,
        { q: `%${search}%` },
      )
      .orderBy('operator.name', 'ASC')
      .take(limit)
      .getMany();

    return { items: rows.map(mapOperatorLinkOption) };
  }

  async findOne(companyId: number, operatorId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: operatorId },
      relations: [...OPERATOR_RELATIONS],
    });
    if (!row) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }
    return serializeOperator(row);
  }

  async getOperationSummary(
    companyId: number,
    operatorId: number,
    periodFrom?: string,
    periodTo?: string,
  ): Promise<OperatorOperationSummaryDto> {
    const operator = await this.repo.findOne({
      where: { companyId, id: operatorId },
      select: ['id', 'paymentSchedule'],
    });
    if (!operator) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }

    const now = new Date();
    const toYmd =
      periodTo?.trim() ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // Ventana amplia para pagos pendientes + métricas recientes (no historial total).
    const lookbackDays = periodFrom?.trim()
      ? 400
      : Math.max(OPERATOR_SUMMARY_RECENT_DAYS, 90);
    const fromDate = new Date(`${toYmd}T12:00:00`);
    fromDate.setDate(fromDate.getDate() - (lookbackDays - 1));
    const fromYmd =
      periodFrom?.trim() ||
      `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;

    const schema = this.tripRepo.metadata.schema ?? TERMINALOPS_SCHEMA;
    const trips = await this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.unit', 'unit')
      .leftJoinAndSelect('trip.tripEquipment', 'tripEquipment')
      .leftJoinAndSelect('tripEquipment.equipment', 'equipment')
      .where('trip.companyId = :companyId', { companyId })
      .andWhere('trip.operatorId = :operatorId', { operatorId })
      .andWhere('trip.deleted_at IS NULL')
      .andWhere(
        `(
          trip.status IN ('scheduled', 'in_transit')
          OR (
            COALESCE(
              trip.completed_at,
              trip.return_at,
              trip.arrived_at,
              trip.departure_at,
              trip.planned_departure_at
            ) AT TIME ZONE 'America/Mexico_City'
          )::date BETWEEN :fromYmd::date AND :toYmd::date
          OR (
            trip.status = 'completed'
            AND COALESCE(trip.operator_quota, 0) > 0
            AND COALESCE(trip.operator_quota, 0) > (
              SELECT COALESCE(SUM(pe.amount), 0)
              FROM ${schema}.expenses pe
              WHERE pe.company_id = trip.company_id
                AND pe.trip_id = trip.id
                AND pe.discarded_at IS NULL
                AND pe.kind IN ('operator_payment', 'operator_commission')
            )
          )
        )`,
        { fromYmd, toYmd },
      )
      .orderBy('trip.plannedDepartureAt', 'DESC')
      .getMany();

    const tripIds = trips.map((t) => t.id);
    const unitIds = [
      ...new Set(
        trips.map((t) => t.unitId).filter((id): id is number => id != null),
      ),
    ];
    const [expenses, units] = await Promise.all([
      tripIds.length > 0
        ? this.expenseRepo.find({
            where: { companyId, tripId: In(tripIds), discardedAt: IsNull() },
            select: ['id', 'tripId', 'kind', 'amount', 'incurredAt'],
          })
        : Promise.resolve([] as Expense[]),
      unitIds.length > 0
        ? this.unitRepo.find({
            where: { companyId, id: In(unitIds) },
            select: ['id', 'trailerBrandAbbr', 'trailerYear', 'plate'],
          })
        : Promise.resolve([] as Unit[]),
    ]);
    const unitsById = new Map(units.map((u) => [u.id, u] as const));
    return buildOperatorOperationSummary(
      trips,
      expenses,
      unitsById,
      now,
      operator.paymentSchedule,
      periodFrom,
      periodTo,
    );
  }

  async confirmTripPayment(
    companyId: number,
    operatorId: number,
    tripId: number,
    actor?: AuthUser,
  ): Promise<OperatorOperationSummaryDto> {
    const operator = await this.repo.findOne({
      where: { companyId, id: operatorId },
      select: ['id', 'paymentMethod'],
    });
    if (!operator) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }

    // Transacción con lock sobre la maniobra: dos confirmaciones simultáneas
    // ya no pueden leer el mismo saldo y duplicar el pago.
    const result = await this.tripRepo.manager.transaction(async (em) => {
      const trip = await em.getRepository(Trip).findOne({
        where: { companyId, id: tripId, operatorId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!trip) {
        throw new NotFoundException(
          `Trip ${tripId} not found for operator ${operatorId}`,
        );
      }
      if (trip.status !== 'completed') {
        throw new BadRequestException(
          'Solo se puede confirmar pago en maniobras completadas.',
        );
      }

      const quota = Number(trip.operatorQuota ?? 0);
      if (!Number.isFinite(quota) || quota <= 0) {
        throw new BadRequestException(
          'La maniobra no tiene cuota de operador.',
        );
      }

      const expenses = await em.getRepository(Expense).find({
        where: { companyId, tripId, discardedAt: IsNull() },
        select: ['id', 'tripId', 'kind', 'amount'],
      });
      let paid = 0;
      for (const expense of expenses) {
        if (
          expense.kind !== 'operator_payment' &&
          expense.kind !== 'operator_commission'
        ) {
          continue;
        }
        const amount = Number(expense.amount ?? 0);
        if (Number.isFinite(amount) && amount > 0) {
          paid += amount;
        }
      }
      const balance = Math.max(0, quota - paid);
      if (balance <= 0) {
        return null;
      }

      const completionYmd =
        tripCompletionAnchorYmd(trip) ?? new Date().toISOString().slice(0, 10);
      const maneuverRef = trip.maneuverCode?.trim() || `#${trip.id}`;
      const paymentMethod = expenseTextColumn(operator.paymentMethod);

      const expenseRepo = em.getRepository(Expense);
      const savedExpense = await expenseRepo.save(
        expenseRepo.create({
          companyId,
          tripId: trip.id,
          category: 'Pago a operador',
          amount: (Math.round(balance * 100) / 100).toFixed(2),
          currency: 'MXN',
          incurredAt: parseOperationalIncurredAt(completionYmd),
          kind: 'operator_payment',
          description: `Pago a operador — maniobra ${maneuverRef}`,
          relatedOperatorId: operatorId,
          relatedUnitId: trip.unitId ?? undefined,
          ...(paymentMethod != null ? { paymentMethod } : {}),
        }),
      );
      return { savedExpense, balance, maneuverRef };
    });

    if (result) {
      await this.activityEvents.record({
        companyId,
        kind: COMPANY_ACTIVITY_KIND.PAYMENT_CONFIRMED,
        entityType: 'expense',
        entityId: result.savedExpense.id,
        subjectLabel: `Operador · maniobra ${result.maneuverRef}`,
        title: 'Pago a operador confirmado',
        actor,
        metadata: {
          operatorId,
          tripId,
          amount: result.balance,
          expenseKind: result.savedExpense.kind,
        },
      });
    }

    return this.getOperationSummary(companyId, operatorId);
  }

  async revertTripPayment(
    companyId: number,
    operatorId: number,
    tripId: number,
    actor?: AuthUser,
  ): Promise<OperatorOperationSummaryDto> {
    const operator = await this.repo.findOne({
      where: { companyId, id: operatorId },
      select: ['id'],
    });
    if (!operator) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }

    const trip = await this.tripRepo.findOne({
      where: { companyId, id: tripId, operatorId, deletedAt: IsNull() },
    });
    if (!trip) {
      throw new NotFoundException(
        `Trip ${tripId} not found for operator ${operatorId}`,
      );
    }

    // Un solo UPDATE atómico: antes se descartaba gasto por gasto y un fallo
    // a la mitad dejaba la reversión incompleta.
    const discardedRows: Array<{ id: number; amount: string }> =
      await this.expenseRepo
        .createQueryBuilder()
        .update(Expense)
        .set({ discardedAt: new Date() })
        .where('company_id = :companyId', { companyId })
        .andWhere('trip_id = :tripId', { tripId })
        .andWhere('discarded_at IS NULL')
        .andWhere(`kind IN ('operator_payment', 'operator_commission')`)
        .returning(['id', 'amount'])
        .execute()
        .then((result) => result.raw as Array<{ id: number; amount: string }>);

    const discarded = discardedRows.length;
    let revertedAmount = 0;
    let revertedExpenseId: number | null = null;
    for (const row of discardedRows) {
      revertedAmount += Number(row.amount ?? 0);
      revertedExpenseId ??= row.id;
    }

    if (discarded === 0) {
      throw new BadRequestException(
        'No hay pagos registrados para revertir en esta maniobra.',
      );
    }
    const maneuverRef = trip.maneuverCode?.trim() || `#${trip.id}`;
    await this.activityEvents.record({
      companyId,
      kind: COMPANY_ACTIVITY_KIND.PAYMENT_REVERTED,
      entityType: 'expense',
      entityId: revertedExpenseId ?? tripId,
      subjectLabel: `Operador · maniobra ${maneuverRef}`,
      title: 'Confirmación de pago a operador removida',
      actor,
      metadata: {
        operatorId,
        tripId,
        amount: Math.round(revertedAmount * 100) / 100,
        discardedExpenses: discarded,
      },
    });

    return this.getOperationSummary(companyId, operatorId);
  }

  async startHrHold(
    companyId: number,
    operatorId: number,
    hold: OperatorHrHoldStatus,
  ) {
    await this.hrHoldWorkflow.startHold(companyId, operatorId, hold);
    return this.findOne(companyId, operatorId);
  }

  async endHrHold(companyId: number, operatorId: number) {
    await this.hrHoldWorkflow.endHold(companyId, operatorId);
    return this.findOne(companyId, operatorId);
  }

  async update(
    companyId: number,
    operatorId: number,
    dto: UpdateOperatorDto,
    actor?: AuthUser,
  ) {
    rejectClientFleetStatusMutation(dto as unknown as Record<string, unknown>);
    await this.findOne(companyId, operatorId);
    const core = this.extractCoreFields(dto);
    if (Object.keys(core).length > 0) {
      await this.repo.update({ id: operatorId, companyId }, core);
    }
    await this.saveNested(operatorId, dto);
    const row = await this.repo.findOne({
      where: { companyId, id: operatorId },
    });
    if (row) {
      await this.activityEvents.record({
        companyId,
        kind: COMPANY_ACTIVITY_KIND.OPERATOR_UPDATED,
        entityType: 'operator',
        entityId: operatorId,
        subjectLabel: row.name?.trim() || `Operador #${operatorId}`,
        title: 'Operador modificado',
        actor,
      });
    }
    return this.findOne(companyId, operatorId);
  }

  async uploadDocument(
    companyId: number,
    operatorId: number,
    slot: OperatorDocumentSlot,
    file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (!(OPERATOR_DOCUMENT_SLOTS as readonly string[]).includes(slot)) {
      throw new BadRequestException('Invalid slot');
    }
    await this.assertOperatorExists(companyId, operatorId);

    const uploaded = await this.fileService.upload(
      OPERATOR_DOCUMENT_STORAGE_FOLDER,
      file,
    );
    const maxSort = await this.documentsRepo
      .createQueryBuilder('d')
      .select('MAX(d.sort_order)', 'max')
      .where('d.operator_id = :operatorId', { operatorId })
      .getRawOne<{ max: string | null }>();
    const sortOrder = Number(maxSort?.max ?? -1) + 1;

    const saved = await this.documentsRepo.save(
      this.documentsRepo.create({
        operatorId,
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
      operatorId: saved.operatorId,
      slot: saved.slot,
      fileName: saved.fileName,
      addedAt: saved.addedAt,
      sortOrder: saved.sortOrder,
      hasStoredFile: true,
    };
  }

  async downloadDocument(
    companyId: number,
    operatorId: number,
    documentId: number,
  ) {
    const document = await this.findDocumentForOperator(
      companyId,
      operatorId,
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
    operatorId: number,
    documentId: number,
  ) {
    const document = await this.findDocumentForOperator(
      companyId,
      operatorId,
      documentId,
    );
    if (document.storageKey) {
      await this.fileService.remove(document.storageKey);
    }
    await this.documentsRepo.delete({ id: documentId, operatorId });
    return { id: documentId, deleted: true };
  }

  private async assertOperatorExists(
    companyId: number,
    operatorId: number,
  ): Promise<void> {
    const row = await this.repo.findOne({
      where: { companyId, id: operatorId },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }
  }

  private async findDocumentForOperator(
    companyId: number,
    operatorId: number,
    documentId: number,
  ): Promise<OperatorDocument> {
    await this.assertOperatorExists(companyId, operatorId);
    const document = await this.documentsRepo.findOne({
      where: { id: documentId, operatorId },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    return document;
  }

  /** Soft delete lógico: oculta de listados/asignaciones y conserva historial en maniobras. */
  async remove(companyId: number, operatorId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: operatorId },
      select: ['id', 'isActive'],
    });
    if (!row) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }
    if (row.isActive === false) {
      return { id: operatorId, deleted: true };
    }
    await this.repo.update({ id: operatorId, companyId }, { isActive: false });
    return { id: operatorId, deleted: true };
  }

  private extractCoreFields(
    dto: CreateOperatorDto | UpdateOperatorDto,
  ): Partial<Operator> {
    const {
      emergencyContact: _ec,
      publicInsurance: _pub,
      privateInsurance: _priv,
      documents: _docs,
      ...rawCore
    } = dto;
    return pickOperatorUserMutableFields(rawCore);
  }

  private async saveNested(
    operatorId: number,
    dto: OperatorNestedPayload & { insuranceKind?: string },
  ): Promise<void> {
    if (dto.emergencyContact) {
      await this.emergencyRepo.save(
        this.emergencyRepo.create({
          operatorId,
          name: dto.emergencyContact.name ?? '',
          relationship: dto.emergencyContact.relationship ?? '',
          phone: dto.emergencyContact.phone ?? '',
          email: dto.emergencyContact.email ?? '',
          authorizedMedicalInfo:
            dto.emergencyContact.authorizedMedicalInfo ?? false,
        }),
      );
    }

    const kindTouched = dto.insuranceKind !== undefined;
    const kind = (dto.insuranceKind ?? '').trim().toLowerCase();

    if (kindTouched && kind === 'none') {
      await this.publicInsuranceRepo.delete({ operatorId });
      await this.privateInsuranceRepo.delete({ operatorId });
    } else if (kindTouched && kind === 'public') {
      await this.privateInsuranceRepo.delete({ operatorId });
      if (dto.publicInsurance) {
        await this.publicInsuranceRepo.save(
          this.publicInsuranceRepo.create({
            operatorId,
            nss: dto.publicInsurance.nss ?? '',
            imssAltaDate: this.emptyDateToUndefined(
              dto.publicInsurance.imssAltaDate,
            ),
            infonavit: dto.publicInsurance.infonavit ?? false,
            infonavitCreditNumber:
              dto.publicInsurance.infonavitCreditNumber ?? '',
            fonacot: dto.publicInsurance.fonacot ?? false,
            fonacotCreditNumber: dto.publicInsurance.fonacotCreditNumber ?? '',
            notes: dto.publicInsurance.notes ?? '',
          }),
        );
      }
    } else if (kindTouched && kind === 'private') {
      await this.publicInsuranceRepo.delete({ operatorId });
      if (dto.privateInsurance) {
        await this.privateInsuranceRepo.save(
          this.privateInsuranceRepo.create({
            operatorId,
            carrier: dto.privateInsurance.carrier ?? '',
            policyNumber: dto.privateInsurance.policyNumber ?? '',
            validFrom: this.emptyDateToUndefined(dto.privateInsurance.validFrom),
            validTo: this.emptyDateToUndefined(dto.privateInsurance.validTo),
            premiumAmount: dto.privateInsurance.premiumAmount ?? '',
            premiumPeriod: dto.privateInsurance.premiumPeriod ?? '',
            deductibleNotes: dto.privateInsurance.deductibleNotes ?? '',
            planSummary: dto.privateInsurance.planSummary ?? '',
          }),
        );
      }
    } else {
      // Compat: si no viene kind, persiste lo enviado sin borrar el otro satélite
      if (dto.publicInsurance) {
        await this.publicInsuranceRepo.save(
          this.publicInsuranceRepo.create({
            operatorId,
            nss: dto.publicInsurance.nss ?? '',
            imssAltaDate: this.emptyDateToUndefined(
              dto.publicInsurance.imssAltaDate,
            ),
            infonavit: dto.publicInsurance.infonavit ?? false,
            infonavitCreditNumber:
              dto.publicInsurance.infonavitCreditNumber ?? '',
            fonacot: dto.publicInsurance.fonacot ?? false,
            fonacotCreditNumber: dto.publicInsurance.fonacotCreditNumber ?? '',
            notes: dto.publicInsurance.notes ?? '',
          }),
        );
      }
      if (dto.privateInsurance) {
        await this.privateInsuranceRepo.save(
          this.privateInsuranceRepo.create({
            operatorId,
            carrier: dto.privateInsurance.carrier ?? '',
            policyNumber: dto.privateInsurance.policyNumber ?? '',
            validFrom: this.emptyDateToUndefined(dto.privateInsurance.validFrom),
            validTo: this.emptyDateToUndefined(dto.privateInsurance.validTo),
            premiumAmount: dto.privateInsurance.premiumAmount ?? '',
            premiumPeriod: dto.privateInsurance.premiumPeriod ?? '',
            deductibleNotes: dto.privateInsurance.deductibleNotes ?? '',
            planSummary: dto.privateInsurance.planSummary ?? '',
          }),
        );
      }
    }

    // Prefer POST/DELETE /operators/:id/documents for binary files.
    // Nested documents[] remains for legacy metadata sync and preserves storage_key.
    if (dto.documents !== undefined) {
      const previous = await this.documentsRepo.find({ where: { operatorId } });
      const previousById = new Map(previous.map((d) => [d.id, d]));
      const keptIds = new Set<number>();

      const nextRows = await Promise.all(
        dto.documents.map(async (doc, index) => {
          const existingDocId = await this.resolveDocumentId(
            operatorId,
            doc.id,
          );
          const previousRow = existingDocId
            ? previousById.get(existingDocId)
            : undefined;
          if (existingDocId) {
            keptIds.add(existingDocId);
          }
          return this.documentsRepo.create({
            ...(existingDocId ? { id: existingDocId } : {}),
            operatorId,
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

      await this.documentsRepo.delete({ operatorId });
      if (nextRows.length > 0) {
        await this.documentsRepo.save(nextRows);
      }
    }
  }

  private async resolveDocumentId(
    operatorId: number,
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
      where: { operatorId, id },
      select: ['id'],
    });
    return row?.id;
  }

  private emptyDateToUndefined(value?: string): string | undefined {
    const t = value?.trim();
    return t ? t : undefined;
  }

  private async applyListMetrics(
    companyId: number,
    operators: Operator[],
  ): Promise<void> {
    if (operators.length === 0) {
      return;
    }
    const operatorIds = operators.map((o) => o.id);
    const [lastTrips, unpaid] = await Promise.all([
      this.loadLastTripsByOperatorId(companyId, operatorIds),
      this.loadUnpaidCompletedTripsForOperators(companyId, operatorIds),
    ]);

    const lastByOperator = new Map<number, Trip>();
    for (const row of lastTrips) {
      if (row.operatorId != null) {
        lastByOperator.set(row.operatorId, row);
      }
    }

    const paymentScheduleByOperatorId = new Map(
      operators.map(
        (operator) => [operator.id, operator.paymentSchedule] as const,
      ),
    );
    const nextPayByOperator = buildNextPayDueByOperatorId(
      unpaid.trips,
      unpaid.expenses,
      paymentScheduleByOperatorId,
    );

    for (const operator of operators) {
      const last = lastByOperator.get(operator.id);
      operator.lastManeuver = last
        ? buildOperatorLastManeuverSnapshot(last)
        : undefined;
      const nextPay = nextPayByOperator.get(operator.id);
      operator.nextPayDueOn = nextPay?.dueOn;
      operator.nextPayDueVariant = nextPay?.variant;
      operator.owedAmount = nextPay?.owedAmount;
    }
  }

  /**
   * Solo maniobras completadas con cuota pendiente (quota − pagos > 0).
   * Evita hidratar todo el historial completed + expenses en memoria.
   */
  private async loadUnpaidCompletedTripsForOperators(
    companyId: number,
    operatorIds: readonly number[],
  ): Promise<{ trips: Trip[]; expenses: Expense[] }> {
    if (operatorIds.length === 0) {
      return { trips: [], expenses: [] };
    }

    const rows = await this.tripRepo.query(
      `
        SELECT
          t.id,
          t.operator_id AS "operatorId",
          t.status,
          t.operator_quota AS "operatorQuota",
          t.return_at AS "returnAt",
          t.arrived_at AS "arrivedAt",
          t.completed_at AS "completedAt",
          t.planned_completion_at AS "plannedCompletionAt",
          t.credit_days AS "creditDays",
          COALESCE(paid.paid_amount, 0) AS "paidAmount"
        FROM ${TERMINALOPS_SCHEMA}.trips t
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(e.amount::numeric), 0) AS paid_amount
          FROM ${TERMINALOPS_SCHEMA}.expenses e
          WHERE e.trip_id = t.id
            AND e.company_id = t.company_id
            AND e.discarded_at IS NULL
            AND e.kind IN ('operator_payment', 'operator_commission')
        ) paid ON TRUE
        WHERE t.company_id = $1
          AND t.deleted_at IS NULL
          AND t.status = 'completed'
          AND t.operator_id = ANY($2::int[])
          AND COALESCE(t.operator_quota, 0) > 0
          AND (
            COALESCE(t.operator_quota, 0) - COALESCE(paid.paid_amount, 0)
          ) > 0.004
      `,
      [companyId, operatorIds],
    );

    const trips: Trip[] = [];
    const expenses: Expense[] = [];

    for (const row of rows as Array<Record<string, unknown>>) {
      const tripId = Number(row['id']);
      const operatorId = Number(row['operatorId']);
      if (!Number.isFinite(tripId) || !Number.isFinite(operatorId)) {
        continue;
      }
      const quotaRaw = row['operatorQuota'];
      const paidAmount = Number(row['paidAmount'] ?? 0);
      trips.push({
        id: tripId,
        operatorId,
        status: String(row['status'] ?? 'completed'),
        operatorQuota:
          quotaRaw == null || quotaRaw === ''
            ? undefined
            : String(quotaRaw),
        returnAt: row['returnAt'] ? new Date(String(row['returnAt'])) : undefined,
        arrivedAt: row['arrivedAt']
          ? new Date(String(row['arrivedAt']))
          : undefined,
        completedAt: row['completedAt']
          ? new Date(String(row['completedAt']))
          : undefined,
        plannedCompletionAt: row['plannedCompletionAt']
          ? new Date(String(row['plannedCompletionAt']))
          : undefined,
        creditDays: Number(row['creditDays'] ?? 0),
      } as Trip);

      if (Number.isFinite(paidAmount) && paidAmount > 0) {
        expenses.push({
          tripId,
          kind: 'operator_payment',
          amount: String(paidAmount),
          discardedAt: null,
        } as Expense);
      }
    }

    return { trips, expenses };
  }

  private async loadLastTripsByOperatorId(
    companyId: number,
    operatorIds: readonly number[],
  ): Promise<Trip[]> {
    if (operatorIds.length === 0) {
      return [];
    }
    const rows = await this.tripRepo.query(
      `
        SELECT DISTINCT ON (t.operator_id)
          t.id,
          t.operator_id AS "operatorId",
          t.maneuver_code AS "maneuverCode",
          t.origin_locality AS "originLocality",
          t.origin_city_municipality AS "originCityMunicipality",
          t.origin_postal_code AS "originPostalCode",
          t.destination_locality AS "destinationLocality",
          t.destination_city_municipality AS "destinationCityMunicipality",
          t.destination_postal_code AS "destinationPostalCode",
          t.status,
          t.completed_at AS "completedAt",
          t.return_at AS "returnAt",
          t.arrived_at AS "arrivedAt",
          t.planned_departure_at AS "plannedDepartureAt"
        FROM ${TERMINALOPS_SCHEMA}.trips t
        WHERE t.company_id = $1
          AND t.deleted_at IS NULL
          AND t.operator_id = ANY($2::int[])
        ORDER BY
          t.operator_id,
          COALESCE(
            t.completed_at,
            t.return_at,
            t.arrived_at,
            t.planned_departure_at
          ) DESC NULLS LAST
      `,
      [companyId, operatorIds],
    );

    return rows.map(
      (row) =>
        ({
          id: row.id,
          operatorId: row.operatorId,
          maneuverCode: row.maneuverCode,
          originLocality: row.originLocality,
          originCityMunicipality: row.originCityMunicipality,
          originPostalCode: row.originPostalCode,
          destinationLocality: row.destinationLocality,
          destinationCityMunicipality: row.destinationCityMunicipality,
          destinationPostalCode: row.destinationPostalCode,
          status: row.status,
          completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
          returnAt: row.returnAt ? new Date(row.returnAt) : undefined,
          arrivedAt: row.arrivedAt ? new Date(row.arrivedAt) : undefined,
          plannedDepartureAt: row.plannedDepartureAt
            ? new Date(row.plannedDepartureAt)
            : undefined,
        }) as unknown as Trip,
    );
  }
}
