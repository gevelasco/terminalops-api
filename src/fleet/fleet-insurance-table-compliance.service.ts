import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import {
  expenseListDayEndExclusiveUtc,
  expenseListDayStartUtc,
} from 'src/expenses/expenses-list.util';
import { Unit } from 'src/units/entities/unit.entity';
import type { FleetInsuranceTableComplianceResponseDto } from './dto/fleet-insurance-table-compliance.dto';
import {
  computeFleetTableInsuranceCompliance,
  emptyInsuranceTableComplianceResponse,
  fleetInsuranceTableQueryRange,
  groupInsuranceExpensesByEquipmentId,
  groupInsuranceExpensesByUnitId,
  type FleetInsuranceComplianceMeta,
} from './fleet-insurance-table-compliance.util';

@Injectable()
export class FleetInsuranceTableComplianceService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
  ) {}

  async listForCompany(companyId: number): Promise<FleetInsuranceTableComplianceResponseDto> {
    const [expenses, units, equipment] = await Promise.all([
      this.loadInsuranceExpenses(companyId),
      this.unitRepo.find({
        where: { companyId, isActive: true },
        relations: ['fleetProfile'],
      }),
      this.equipmentRepo.find({
        where: { companyId, isActive: true },
        relations: ['fleetProfile'],
      }),
    ]);

    if (units.length === 0 && equipment.length === 0) {
      return emptyInsuranceTableComplianceResponse();
    }

    const byUnit = groupInsuranceExpensesByUnitId(expenses);
    const byEquipment = groupInsuranceExpensesByEquipmentId(expenses);
    const today = new Date();

    const unitsOut: FleetInsuranceTableComplianceResponseDto['units'] = {};
    for (const unit of units) {
      const meta = metaFromUnitProfile(unit);
      unitsOut[String(unit.id)] = computeFleetTableInsuranceCompliance(
        meta,
        byUnit.get(unit.id) ?? [],
        today,
      );
    }

    const equipmentOut: FleetInsuranceTableComplianceResponseDto['equipment'] = {};
    for (const row of equipment) {
      const meta = metaFromEquipmentProfile(row);
      equipmentOut[String(row.id)] = computeFleetTableInsuranceCompliance(
        meta,
        byEquipment.get(row.id) ?? [],
        today,
      );
    }

    return { units: unitsOut, equipment: equipmentOut };
  }

  private async loadInsuranceExpenses(companyId: number): Promise<Expense[]> {
    const range = fleetInsuranceTableQueryRange();
    return this.expenseRepo
      .createQueryBuilder('e')
      .where('e.companyId = :companyId', { companyId })
      .andWhere('e.discardedAt IS NULL')
      .andWhere('e.kind = :kind', { kind: 'insurance' })
      .andWhere('e.incurredAt >= :from', {
        from: expenseListDayStartUtc(range.from),
      })
      .andWhere('e.incurredAt < :toExclusive', {
        toExclusive: expenseListDayEndExclusiveUtc(range.to),
      })
      .getMany();
  }
}

function metaFromUnitProfile(unit: Unit): FleetInsuranceComplianceMeta {
  const profile = unit.fleetProfile;
  if (!profile) {
    return {};
  }
  return {
    insurancePolicyNumber: profile.insurancePolicyNumber,
    insuranceContractDate: profile.insuranceContractDate,
    insuranceLastPaymentDate: profile.insuranceLastPaymentDate,
    insurancePaymentCadence: profile.insurancePaymentCadence,
  };
}

function metaFromEquipmentProfile(row: Equipment): FleetInsuranceComplianceMeta {
  const profile = row.fleetProfile;
  if (!profile) {
    return {};
  }
  return {
    insurancePolicyNumber: profile.insurancePolicyNumber,
    insuranceContractDate: profile.insuranceContractDate,
    insuranceLastPaymentDate: profile.insuranceLastPaymentDate,
    insurancePaymentCadence: profile.insurancePaymentCadence,
  };
}
