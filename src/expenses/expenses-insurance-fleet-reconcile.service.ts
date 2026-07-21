import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import {
  coverageCycleDueDateForInstallment,
  coverageMaxCycleDueOnOrBefore,
  parseCoverageInstallmentIndex,
} from 'src/fleet/fleet-coverage-payment-period.util';
import {
  GPS_INITIAL_SERVICE_DESC_PREFIX,
  GPS_PAYMENT_EXPENSE_DESC_PREFIX,
} from 'src/fleet/fleet-gps-expense-sync.util';
import {
  INSURANCE_INITIAL_PREMIUM_DESC_PREFIX,
  INSURANCE_PAYMENT_EXPENSE_DESC_PREFIX,
} from 'src/fleet/fleet-insurance-expense-sync.util';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';

@Injectable()
export class ExpensesInsuranceFleetReconcileService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(UnitFleetProfile)
    private readonly unitProfileRepo: Repository<UnitFleetProfile>,
    @InjectRepository(EquipmentFleetProfile)
    private readonly equipmentProfileRepo: Repository<EquipmentFleetProfile>,
  ) {}

  async reconcileAfterInsuranceExpenseDiscard(expense: Expense): Promise<void> {
    if (expense.kind !== 'insurance') {
      return;
    }
    if (expense.relatedEquipmentId != null) {
      await this.reconcileEquipmentInsuranceProfile(expense.relatedEquipmentId);
      return;
    }
    if (expense.relatedUnitId != null) {
      await this.reconcileUnitInsuranceProfile(expense.relatedUnitId);
    }
  }

  async reconcileAfterGpsExpenseDiscard(expense: Expense): Promise<void> {
    if (expense.kind !== 'gps' || expense.relatedUnitId == null) {
      return;
    }
    await this.reconcileUnitGpsProfile(expense.relatedUnitId);
  }

  private async reconcileUnitInsuranceProfile(unitId: number): Promise<void> {
    const profile = await this.unitProfileRepo.findOne({ where: { unitId } });
    if (!profile) {
      return;
    }
    const lastPaymentDate = await this.resolveLastCoveragePaymentDate(
      {
        kind: 'insurance',
        insuranceTarget: 'unit',
        relatedUnitId: unitId,
      },
      profile.insurancePaymentCadence ?? undefined,
      profile.insuranceContractDate ?? undefined,
    );
    await this.unitProfileRepo.update({ unitId }, { insuranceLastPaymentDate: lastPaymentDate });
  }

  private async reconcileUnitGpsProfile(unitId: number): Promise<void> {
    const profile = await this.unitProfileRepo.findOne({ where: { unitId } });
    if (!profile) {
      return;
    }
    const lastPaymentDate = await this.resolveLastCoveragePaymentDate(
      {
        kind: 'gps',
        relatedUnitId: unitId,
      },
      profile.gpsPaymentCadence ?? undefined,
      profile.gpsContractDate ?? undefined,
    );
    await this.unitProfileRepo.update({ unitId }, { gpsLastPaymentDate: lastPaymentDate });
  }

  private async reconcileEquipmentInsuranceProfile(equipmentId: number): Promise<void> {
    const profile = await this.equipmentProfileRepo.findOne({
      where: { equipmentId },
    });
    if (!profile) {
      return;
    }
    const lastPaymentDate = await this.resolveLastCoveragePaymentDate(
      {
        kind: 'insurance',
        insuranceTarget: 'equipment',
        relatedEquipmentId: equipmentId,
      },
      profile.insurancePaymentCadence ?? undefined,
      profile.insuranceContractDate ?? undefined,
    );
    await this.equipmentProfileRepo.update(
      { equipmentId },
      { insuranceLastPaymentDate: lastPaymentDate },
    );
  }

  private async resolveLastCoveragePaymentDate(
    params:
      | {
          kind: 'gps';
          relatedUnitId: number;
        }
      | {
          kind: 'insurance';
          insuranceTarget: 'unit';
          relatedUnitId: number;
        }
      | {
          kind: 'insurance';
          insuranceTarget: 'equipment';
          relatedEquipmentId: number;
        },
    cadence: string | undefined,
    contractDate: string | undefined,
  ): Promise<string | null> {
    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .where('e.kind = :kind', { kind: params.kind })
      .andWhere('e.discardedAt IS NULL');

    if (params.kind === 'gps') {
      qb.andWhere(
        '(e.description ILIKE :paymentPrefix OR e.description ILIKE :initialPrefix)',
        {
          paymentPrefix: `${GPS_PAYMENT_EXPENSE_DESC_PREFIX}%`,
          initialPrefix: `${GPS_INITIAL_SERVICE_DESC_PREFIX}%`,
        },
      ).andWhere('e.relatedUnitId = :relatedUnitId', {
        relatedUnitId: params.relatedUnitId,
      });
    } else {
      qb.andWhere(
        '(e.description ILIKE :paymentPrefix OR e.description ILIKE :initialPrefix)',
        {
          paymentPrefix: `${INSURANCE_PAYMENT_EXPENSE_DESC_PREFIX}%`,
          initialPrefix: `${INSURANCE_INITIAL_PREMIUM_DESC_PREFIX}%`,
        },
      );
      if (params.insuranceTarget === 'unit') {
        qb.andWhere('e.relatedUnitId = :relatedUnitId', {
          relatedUnitId: params.relatedUnitId,
        });
      } else {
        qb.andWhere('e.relatedEquipmentId = :relatedEquipmentId', {
          relatedEquipmentId: params.relatedEquipmentId,
        });
      }
    }

    const expenses = await qb.getMany();
    if (expenses.length === 0) {
      return null;
    }

    let maxInstallment = 0;
    for (const expense of expenses) {
      const installment = parseCoverageInstallmentIndex(expense.description);
      if (installment != null && installment > maxInstallment) {
        maxInstallment = installment;
      }
    }

    if (maxInstallment > 0) {
      return coverageCycleDueDateForInstallment(
        cadence,
        contractDate,
        maxInstallment,
        contractDate,
      );
    }

    let latestIncurred = '';
    for (const expense of expenses) {
      const incurred = formatOperationalIncurredDateYmd(expense.incurredAt);
      if (!latestIncurred || incurred.localeCompare(latestIncurred) > 0) {
        latestIncurred = incurred;
      }
    }

    return coverageMaxCycleDueOnOrBefore(cadence, contractDate, latestIncurred);
  }
}
