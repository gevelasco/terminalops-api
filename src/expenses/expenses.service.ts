import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeExpense } from 'src/common/serializers/expense.serializer';
import { ResourcePublicIdService } from 'src/common/tenant/resource-public-id.service';
import { Expense } from 'src/expenses/entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly repo: Repository<Expense>,
    private readonly publicIds: ResourcePublicIdService,
  ) {}

  async create(
    companyId: string,
    companyPublicId: number,
    dto: CreateExpenseDto,
  ) {
    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        category: dto.category,
        amount: String(dto.amount),
        currency: dto.currency ?? 'MXN',
        incurredAt: new Date(dto.incurredAt),
        kind: dto.kind,
        tripId: dto.tripId
          ? await this.publicIds.resolveTripInternalId(companyId, dto.tripId)
          : undefined,
        relatedUnitId: dto.relatedUnitId
          ? await this.publicIds.resolveUnitInternalId(companyId, dto.relatedUnitId)
          : undefined,
        relatedEquipmentId: dto.relatedEquipmentId
          ? await this.publicIds.resolveEquipmentInternalId(
              companyId,
              dto.relatedEquipmentId,
            )
          : undefined,
        relatedOperatorId: dto.relatedOperatorId
          ? await this.publicIds.resolveOperatorInternalId(
              companyId,
              dto.relatedOperatorId,
            )
          : undefined,
        isOperationalProvision: dto.isOperationalProvision ?? false,
      }),
    );
    return this.findOne(companyId, saved.publicId, companyPublicId);
  }

  async findAll(companyId: string, companyPublicId: number) {
    const rows = await this.repo.find({
      where: { companyId },
      relations: ['trip', 'relatedUnit', 'relatedEquipment', 'relatedOperator'],
      order: { incurredAt: 'DESC' },
    });
    return rows.map((row) => serializeExpense(row, companyPublicId));
  }

  async findOne(
    companyId: string,
    expensePublicId: number,
    companyPublicId: number,
  ) {
    const row = await this.repo.findOne({
      where: { companyId, publicId: expensePublicId },
      relations: ['trip', 'relatedUnit', 'relatedEquipment', 'relatedOperator'],
    });
    if (!row) {
      throw new NotFoundException(`Expense ${expensePublicId} not found`);
    }
    return serializeExpense(row, companyPublicId);
  }

  async update(
    companyId: string,
    expensePublicId: number,
    companyPublicId: number,
    dto: UpdateExpenseDto,
  ) {
    const internalId = await this.publicIds.resolveExpenseInternalId(
      companyId,
      expensePublicId,
    );
    const { amount, incurredAt, tripId, relatedUnitId, relatedEquipmentId, relatedOperatorId, ...rest } =
      dto;
    await this.repo.update(
      { id: internalId, companyId },
      {
        ...rest,
        ...(amount !== undefined && { amount: String(amount) }),
        ...(incurredAt && { incurredAt: new Date(incurredAt) }),
        ...(tripId !== undefined && tripId
          ? {
              tripId: await this.publicIds.resolveTripInternalId(
                companyId,
                tripId,
              ),
            }
          : {}),
        ...(relatedUnitId !== undefined && relatedUnitId
          ? {
              relatedUnitId: await this.publicIds.resolveUnitInternalId(
                companyId,
                relatedUnitId,
              ),
            }
          : {}),
        ...(relatedEquipmentId !== undefined && relatedEquipmentId
          ? {
              relatedEquipmentId: await this.publicIds.resolveEquipmentInternalId(
                companyId,
                relatedEquipmentId,
              ),
            }
          : {}),
        ...(relatedOperatorId !== undefined && relatedOperatorId
          ? {
              relatedOperatorId: await this.publicIds.resolveOperatorInternalId(
                companyId,
                relatedOperatorId,
              ),
            }
          : {}),
      },
    );
    return this.findOne(companyId, expensePublicId, companyPublicId);
  }

  async remove(companyId: string, expensePublicId: number) {
    const internalId = await this.publicIds.resolveExpenseInternalId(
      companyId,
      expensePublicId,
    );
    await this.repo.delete({ id: internalId, companyId });
    return { id: expensePublicId, deleted: true };
  }
}
