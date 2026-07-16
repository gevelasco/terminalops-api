import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { serializeOperator } from 'src/common/serializers/operator.serializer';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import {
  buildNextPayDueByOperatorId,
  buildOperatorLastManeuverSnapshot,
} from 'src/operators/operator-list-enrichment.util';
import { buildOperatorOperationSummary } from 'src/operators/operator-operation-summary.util';
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

export type OperatorsFindAllOptions = FleetListAvailableOptions;

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
    private readonly activityEvents: ActivityEventsService,
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

  async findAll(companyId: number, options?: OperatorsFindAllOptions) {
    const qb = this.repo
      .createQueryBuilder('operator')
      .leftJoinAndSelect('operator.emergencyContact', 'emergencyContact')
      .leftJoinAndSelect('operator.publicInsurance', 'publicInsurance')
      .leftJoinAndSelect('operator.privateInsurance', 'privateInsurance')
      .leftJoinAndSelect('operator.documents', 'documents')
      .loadRelationCountAndMap('operator.maneuverCount', 'operator.trips', 'trip')
      .where('operator.companyId = :companyId', { companyId });

    if (options?.available) {
      qb.andWhere('operator.isActive = :isActive', { isActive: true }).andWhere(
        'operator.status = :status',
        { status: FLEET_ASSIGNABLE_LIST_STATUS },
      );
    }

    const rows = await qb
      .orderBy('operator.name', 'ASC')
      .addOrderBy('documents.sortOrder', 'ASC')
      .getMany();

    if (!options?.available) {
      await this.applyListMetrics(companyId, rows);
    }
    return rows.map((row) => serializeOperator(row));
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
    const trips = await this.tripRepo.find({
      where: { companyId, operatorId },
      relations: ['unit', 'tripEquipment', 'tripEquipment.equipment'],
      order: { plannedDepartureAt: 'DESC' },
    });
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
      new Date(),
      operator.paymentSchedule,
      periodFrom,
      periodTo,
    );
  }

  async confirmTripPayment(
    companyId: number,
    operatorId: number,
    tripId: number,
  ): Promise<OperatorOperationSummaryDto> {
    const operator = await this.repo.findOne({
      where: { companyId, id: operatorId },
      select: ['id', 'paymentMethod'],
    });
    if (!operator) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }

    const trip = await this.tripRepo.findOne({
      where: { companyId, id: tripId, operatorId },
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
      throw new BadRequestException('La maniobra no tiene cuota de operador.');
    }

    const expenses = await this.expenseRepo.find({
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
      return this.getOperationSummary(companyId, operatorId);
    }

    const completionYmd =
      tripCompletionAnchorYmd(trip) ??
      new Date().toISOString().slice(0, 10);
    const maneuverRef = trip.maneuverCode?.trim() || `#${trip.id}`;
    const paymentMethod = expenseTextColumn(operator.paymentMethod);

    await this.expenseRepo.save(
      this.expenseRepo.create({
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
        isOperationalProvision: false,
        ...(paymentMethod != null ? { paymentMethod } : {}),
      }),
    );

    return this.getOperationSummary(companyId, operatorId);
  }

  async revertTripPayment(
    companyId: number,
    operatorId: number,
    tripId: number,
  ): Promise<OperatorOperationSummaryDto> {
    const operator = await this.repo.findOne({
      where: { companyId, id: operatorId },
      select: ['id'],
    });
    if (!operator) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }

    const trip = await this.tripRepo.findOne({
      where: { companyId, id: tripId, operatorId },
    });
    if (!trip) {
      throw new NotFoundException(
        `Trip ${tripId} not found for operator ${operatorId}`,
      );
    }

    const expenses = await this.expenseRepo.find({
      where: { companyId, tripId, discardedAt: IsNull() },
    });

    const now = new Date();
    let discarded = 0;
    for (const expense of expenses) {
      if (
        expense.kind !== 'operator_payment' &&
        expense.kind !== 'operator_commission'
      ) {
        continue;
      }
      expense.discardedAt = now;
      await this.expenseRepo.save(expense);
      discarded += 1;
    }

    if (discarded === 0) {
      throw new BadRequestException(
        'No hay pagos registrados para revertir en esta maniobra.',
      );
    }

    return this.getOperationSummary(companyId, operatorId);
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
    const row = await this.repo.findOne({ where: { companyId, id: operatorId } });
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

  async remove(companyId: number, operatorId: number) {
    await this.findOne(companyId, operatorId);
    await this.repo.delete({ id: operatorId, companyId });
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
    return pickOperatorUserMutableFields(
      rawCore as unknown as Record<string, unknown>,
    ) as Partial<Operator>;
  }

  private async saveNested(
    operatorId: number,
    dto: OperatorNestedPayload,
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

    if (dto.publicInsurance) {
      await this.publicInsuranceRepo.save(
        this.publicInsuranceRepo.create({
          operatorId,
          nss: dto.publicInsurance.nss ?? '',
          imssAltaDate: this.emptyDateToUndefined(dto.publicInsurance.imssAltaDate),
          infonavit: dto.publicInsurance.infonavit ?? false,
          infonavitCreditNumber: dto.publicInsurance.infonavitCreditNumber ?? '',
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

    if (dto.documents !== undefined) {
      await this.documentsRepo.delete({ operatorId });
      if (dto.documents.length > 0) {
        await this.documentsRepo.save(
          await Promise.all(
            dto.documents.map(async (doc, index) => {
              const existingDocId = await this.resolveDocumentId(
                operatorId,
                doc.id,
              );
              return this.documentsRepo.create({
                ...(existingDocId ? { id: existingDocId } : {}),
                operatorId,
                fileName: doc.fileName,
                slot: doc.slot,
                addedAt: doc.addedAt ?? new Date().toISOString().slice(0, 10),
                sortOrder: index,
              });
            }),
          ),
        );
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
    const [lastTrips, completedTrips, expenses] = await Promise.all([
      this.loadLastTripsByOperatorId(companyId, operatorIds),
      this.tripRepo.find({
        where: {
          companyId,
          operatorId: In(operatorIds),
          status: 'completed',
        },
        select: [
          'id',
          'operatorId',
          'status',
          'operatorQuota',
          'returnAt',
          'arrivedAt',
          'completedAt',
          'plannedCompletionAt',
          'creditDays',
        ],
      }),
      this.expenseRepo.find({
        where: { companyId, discardedAt: IsNull() },
        select: ['tripId', 'kind', 'amount'],
      }),
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
      completedTrips,
      expenses,
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

  private async loadLastTripsByOperatorId(
    companyId: number,
    operatorIds: readonly number[],
  ): Promise<Trip[]> {
    if (operatorIds.length === 0) {
      return [];
    }
    const rows = (await this.tripRepo.query(
      `
        SELECT DISTINCT ON (t.operator_id)
          t.id,
          t.operator_id AS "operatorId",
          t.maneuver_code AS "maneuverCode",
          t.origin,
          t.destination,
          t.status,
          t.completed_at AS "completedAt",
          t.return_at AS "returnAt",
          t.arrived_at AS "arrivedAt",
          t.planned_departure_at AS "plannedDepartureAt"
        FROM ${TERMINALOPS_SCHEMA}.trips t
        WHERE t.company_id = $1
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
    )) as Array<{
      id: number;
      operatorId: number;
      maneuverCode: string;
      origin: string;
      destination: string;
      status: string;
      completedAt?: Date | string | null;
      returnAt?: Date | string | null;
      arrivedAt?: Date | string | null;
      plannedDepartureAt?: Date | string | null;
    }>;

    return rows.map(
      (row) =>
        ({
          id: row.id,
          operatorId: row.operatorId,
          maneuverCode: row.maneuverCode,
          origin: row.origin,
          destination: row.destination,
          status: row.status,
          completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
          returnAt: row.returnAt ? new Date(row.returnAt) : undefined,
          arrivedAt: row.arrivedAt ? new Date(row.arrivedAt) : undefined,
          plannedDepartureAt: row.plannedDepartureAt
            ? new Date(row.plannedDepartureAt)
            : undefined,
        }) as Trip,
    );
  }
}
