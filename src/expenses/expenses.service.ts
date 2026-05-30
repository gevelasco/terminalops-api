import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeExpense } from 'src/common/serializers/expense.serializer';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

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
  ) {}

  async create(companyId: number, dto: CreateExpenseDto) {
    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        category: dto.category,
        amount: String(dto.amount),
        currency: dto.currency ?? 'MXN',
        incurredAt: new Date(dto.incurredAt),
        kind: dto.kind,
        tripId: dto.tripId
          ? await this.resolveTripId(companyId, dto.tripId)
          : undefined,
        relatedUnitId: dto.relatedUnitId
          ? await this.resolveUnitId(companyId, dto.relatedUnitId)
          : undefined,
        relatedEquipmentId: dto.relatedEquipmentId
          ? await this.resolveEquipmentId(companyId, dto.relatedEquipmentId)
          : undefined,
        relatedOperatorId: dto.relatedOperatorId
          ? await this.resolveOperatorId(companyId, dto.relatedOperatorId)
          : undefined,
        isOperationalProvision: dto.isOperationalProvision ?? false,
      }),
    );
    return this.findOne(companyId, saved.id);
  }

  async findAll(companyId: number) {
    const rows = await this.repo.find({
      where: { companyId },
      relations: ['trip', 'relatedUnit', 'relatedEquipment', 'relatedOperator'],
      order: { incurredAt: 'DESC' },
    });
    return rows.map((row) => serializeExpense(row));
  }

  async findOne(companyId: number, expenseId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: expenseId },
      relations: ['trip', 'relatedUnit', 'relatedEquipment', 'relatedOperator'],
    });
    if (!row) {
      throw new NotFoundException(`Expense ${expenseId} not found`);
    }
    return serializeExpense(row);
  }

  async update(companyId: number, expenseId: number, dto: UpdateExpenseDto) {
    await this.findOne(companyId, expenseId);
    const {
      amount,
      incurredAt,
      tripId,
      relatedUnitId,
      relatedEquipmentId,
      relatedOperatorId,
      ...rest
    } = dto;
    await this.repo.update(
      { id: expenseId, companyId },
      {
        ...rest,
        ...(amount !== undefined && { amount: String(amount) }),
        ...(incurredAt && { incurredAt: new Date(incurredAt) }),
        ...(tripId !== undefined && tripId
          ? { tripId: await this.resolveTripId(companyId, tripId) }
          : {}),
        ...(relatedUnitId !== undefined && relatedUnitId
          ? { relatedUnitId: await this.resolveUnitId(companyId, relatedUnitId) }
          : {}),
        ...(relatedEquipmentId !== undefined && relatedEquipmentId
          ? {
              relatedEquipmentId: await this.resolveEquipmentId(
                companyId,
                relatedEquipmentId,
              ),
            }
          : {}),
        ...(relatedOperatorId !== undefined && relatedOperatorId
          ? {
              relatedOperatorId: await this.resolveOperatorId(
                companyId,
                relatedOperatorId,
              ),
            }
          : {}),
      },
    );
    return this.findOne(companyId, expenseId);
  }

  async remove(companyId: number, expenseId: number) {
    await this.findOne(companyId, expenseId);
    await this.repo.delete({ id: expenseId, companyId });
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
