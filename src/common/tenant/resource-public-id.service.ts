import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from 'src/clients/entities/client.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';

function parsePublicId(value: number | string, label: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new NotFoundException(`${label} ${value} not found`);
  }
  return n;
}

@Injectable()
export class ResourcePublicIdService {
  constructor(
    @InjectRepository(Operator)
    private readonly operatorsRepo: Repository<Operator>,
    @InjectRepository(Client)
    private readonly clientsRepo: Repository<Client>,
    @InjectRepository(Unit)
    private readonly unitsRepo: Repository<Unit>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(Expense)
    private readonly expensesRepo: Repository<Expense>,
  ) {}

  async resolveOperatorInternalId(
    companyId: string,
    publicId: number | string,
  ): Promise<string> {
    const pid = parsePublicId(publicId, 'Operator');
    const row = await this.operatorsRepo.findOne({
      where: { companyId, publicId: pid },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Operator ${pid} not found`);
    }
    return row.id;
  }

  async resolveClientInternalId(
    companyId: string,
    publicId: number | string,
  ): Promise<string> {
    const pid = parsePublicId(publicId, 'Client');
    const row = await this.clientsRepo.findOne({
      where: { companyId, publicId: pid },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Client ${pid} not found`);
    }
    return row.id;
  }

  async resolveUnitInternalId(
    companyId: string,
    publicId: number | string,
  ): Promise<string> {
    const pid = parsePublicId(publicId, 'Unit');
    const row = await this.unitsRepo.findOne({
      where: { companyId, publicId: pid },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Unit ${pid} not found`);
    }
    return row.id;
  }

  async resolveEquipmentInternalId(
    companyId: string,
    publicId: number | string,
  ): Promise<string> {
    const pid = parsePublicId(publicId, 'Equipment');
    const row = await this.equipmentRepo.findOne({
      where: { companyId, publicId: pid },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Equipment ${pid} not found`);
    }
    return row.id;
  }

  async resolveTripInternalId(
    companyId: string,
    publicId: number | string,
  ): Promise<string> {
    const pid = parsePublicId(publicId, 'Trip');
    const row = await this.tripsRepo.findOne({
      where: { companyId, publicId: pid },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Trip ${pid} not found`);
    }
    return row.id;
  }

  async resolveExpenseInternalId(
    companyId: string,
    publicId: number | string,
  ): Promise<string> {
    const pid = parsePublicId(publicId, 'Expense');
    const row = await this.expensesRepo.findOne({
      where: { companyId, publicId: pid },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Expense ${pid} not found`);
    }
    return row.id;
  }

  /** Resuelve id público o UUID legado (solo durante transición). */
  async resolveClientRef(
    companyId: string,
    ref: string | undefined,
  ): Promise<string | undefined> {
    const t = ref?.trim();
    if (!t) {
      return undefined;
    }
    if (/^\d+$/.test(t)) {
      return this.resolveClientInternalId(companyId, t);
    }
    const row = await this.clientsRepo.findOne({
      where: { companyId, id: t },
      select: ['id'],
    });
    return row?.id;
  }

  async resolveUnitRef(
    companyId: string,
    ref: string | undefined,
  ): Promise<string | undefined> {
    const t = ref?.trim();
    if (!t) {
      return undefined;
    }
    if (/^\d+$/.test(t)) {
      return this.resolveUnitInternalId(companyId, t);
    }
    const row = await this.unitsRepo.findOne({
      where: { companyId, id: t },
      select: ['id'],
    });
    return row?.id;
  }

  async resolveOperatorRef(
    companyId: string,
    ref: string | undefined,
  ): Promise<string | undefined> {
    const t = ref?.trim();
    if (!t) {
      return undefined;
    }
    if (/^\d+$/.test(t)) {
      return this.resolveOperatorInternalId(companyId, t);
    }
    const row = await this.operatorsRepo.findOne({
      where: { companyId, id: t },
      select: ['id'],
    });
    return row?.id;
  }

  async resolveEquipmentRefs(
    companyId: string,
    refs: string[] | undefined,
  ): Promise<string[]> {
    if (!refs?.length) {
      return [];
    }
    const out: string[] = [];
    for (const ref of refs) {
      const t = ref?.trim();
      if (!t) {
        continue;
      }
      if (/^\d+$/.test(t)) {
        out.push(await this.resolveEquipmentInternalId(companyId, t));
      } else {
        const row = await this.equipmentRepo.findOne({
          where: { companyId, id: t },
          select: ['id'],
        });
        if (row) {
          out.push(row.id);
        }
      }
    }
    return out;
  }
}
