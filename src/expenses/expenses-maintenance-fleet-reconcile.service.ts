import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from 'src/expenses/entities/expense.entity';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import {
  maintenanceEntryMatchesExpense,
} from 'src/fleet/fleet-maintenance-expense-sync.util';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';

@Injectable()
export class ExpensesMaintenanceFleetReconcileService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(FleetMaintenanceEntry)
    private readonly maintenanceRepo: Repository<FleetMaintenanceEntry>,
  ) {}

  async reconcileAfterMaintenanceExpenseDiscard(expense: Expense): Promise<void> {
    if (expense.kind !== 'maintenance') {
      return;
    }
    if (expense.relatedEquipmentId != null) {
      await this.deleteMatchingMaintenanceEntry({
        equipmentId: expense.relatedEquipmentId,
        expense,
      });
      return;
    }
    if (expense.relatedUnitId != null) {
      await this.deleteMatchingMaintenanceEntry({
        unitId: expense.relatedUnitId,
        expense,
      });
    }
  }

  private async deleteMatchingMaintenanceEntry(params: {
    unitId?: number;
    equipmentId?: number;
    expense: Expense;
  }): Promise<void> {
    const where = params.unitId != null
      ? { unitId: params.unitId }
      : { equipmentId: params.equipmentId };
    const entries = await this.maintenanceRepo.find({
      where,
      order: { sortOrder: 'ASC' },
    });
    const incurredYmd = formatOperationalIncurredDateYmd(params.expense.incurredAt);
    const matched = entries.find((entry) =>
      maintenanceEntryMatchesExpense(entry, params.expense, incurredYmd),
    );
    if (!matched) {
      return;
    }
    await this.maintenanceRepo.delete({ id: matched.id });
  }
}
