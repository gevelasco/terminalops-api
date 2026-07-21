import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import { verificationScopeFromExpenseText } from 'src/expenses/expense-payload.util';
import { FleetVerificationEntry } from 'src/units/entities/fleet-verification-entry.entity';

@Injectable()
export class ExpensesVerificationFleetReconcileService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(FleetVerificationEntry)
    private readonly verificationRepo: Repository<FleetVerificationEntry>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
  ) {}

  async reconcileAfterVerificationExpenseDiscard(expense: Expense): Promise<void> {
    if (expense.kind !== 'verification') {
      return;
    }
    const scope = verificationScopeFromExpenseText(
      expense.category,
      expense.description,
    );
    if (!scope) {
      return;
    }

    const discardedDate = formatOperationalIncurredDateYmd(expense.incurredAt);

    if (expense.relatedEquipmentId != null) {
      await this.deleteMatchingVerificationEntry({
        equipmentId: expense.relatedEquipmentId,
        scope,
        discardedDate,
      });
      return;
    }

    if (expense.relatedUnitId == null) {
      return;
    }

    const unitReconciled = await this.deleteMatchingVerificationEntry({
      unitId: expense.relatedUnitId,
      scope,
      discardedDate,
    });

    if (!unitReconciled) {
      await this.reconcileEquipmentProfilesOnUnit({
        companyId: expense.companyId,
        unitId: expense.relatedUnitId,
        scope,
        discardedDate,
      });
    }
  }

  private async deleteMatchingVerificationEntry(params: {
    unitId?: number;
    equipmentId?: number;
    scope: string;
    discardedDate: string;
  }): Promise<boolean> {
    const where =
      params.unitId != null
        ? { unitId: params.unitId, scope: params.scope as FleetVerificationEntry['scope'] }
        : {
            equipmentId: params.equipmentId,
            scope: params.scope as FleetVerificationEntry['scope'],
          };
    const entries = await this.verificationRepo.find({ where });
    const matched = entries.find((entry) => (entry.entryDate ?? '').trim() === params.discardedDate);
    if (!matched) {
      return false;
    }
    await this.verificationRepo.delete({ id: matched.id });
    return true;
  }

  private async reconcileEquipmentProfilesOnUnit(params: {
    companyId: number;
    unitId: number;
    scope: string;
    discardedDate: string;
  }): Promise<void> {
    const equipmentRows = await this.equipmentRepo.find({
      where: { companyId: params.companyId, unitId: params.unitId },
      select: ['id'],
    });
    for (const equipment of equipmentRows) {
      await this.deleteMatchingVerificationEntry({
        equipmentId: equipment.id,
        scope: params.scope,
        discardedDate: params.discardedDate,
      });
    }
  }
}
