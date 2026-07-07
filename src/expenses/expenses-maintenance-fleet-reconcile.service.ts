import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import {
  maintenanceEntryMatchesExpense,
  recomputeLastMaintenanceFields,
} from 'src/fleet/fleet-maintenance-expense-sync.util';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';

@Injectable()
export class ExpensesMaintenanceFleetReconcileService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(FleetMaintenanceEntry)
    private readonly maintenanceRepo: Repository<FleetMaintenanceEntry>,
    @InjectRepository(UnitFleetProfile)
    private readonly unitProfileRepo: Repository<UnitFleetProfile>,
    @InjectRepository(EquipmentFleetProfile)
    private readonly equipmentProfileRepo: Repository<EquipmentFleetProfile>,
  ) {}

  async reconcileAfterMaintenanceExpenseDiscard(expense: Expense): Promise<void> {
    if (expense.kind !== 'maintenance') {
      return;
    }
    if (expense.maintenanceTarget === 'unit' && expense.relatedUnitId != null) {
      await this.reconcileUnitMaintenance(expense.relatedUnitId, expense);
      return;
    }
    if (
      expense.maintenanceTarget === 'equipment' &&
      expense.relatedEquipmentId != null
    ) {
      await this.reconcileEquipmentMaintenance(expense.relatedEquipmentId, expense);
    }
  }

  private async reconcileUnitMaintenance(
    unitId: number,
    expense: Expense,
  ): Promise<void> {
    const entries = await this.maintenanceRepo.find({
      where: { unitId },
      order: { sortOrder: 'ASC' },
    });
    const incurredYmd = formatOperationalIncurredDateYmd(expense.incurredAt);
    const matched = entries.find((entry) =>
      maintenanceEntryMatchesExpense(entry, expense, incurredYmd),
    );
    const remaining = matched
      ? entries.filter((entry) => entry.id !== matched.id)
      : entries;

    if (matched) {
      await this.maintenanceRepo.delete({ id: matched.id });
    }

    const profile = await this.unitProfileRepo.findOne({ where: { unitId } });
    if (!profile) {
      return;
    }

    const patch = recomputeLastMaintenanceFields(remaining);
    await this.unitProfileRepo.update({ unitId }, patch);
  }

  private async reconcileEquipmentMaintenance(
    equipmentId: number,
    expense: Expense,
  ): Promise<void> {
    const entries = await this.maintenanceRepo.find({
      where: { equipmentId },
      order: { sortOrder: 'ASC' },
    });
    const incurredYmd = formatOperationalIncurredDateYmd(expense.incurredAt);
    const matched = entries.find((entry) =>
      maintenanceEntryMatchesExpense(entry, expense, incurredYmd),
    );
    const remaining = matched
      ? entries.filter((entry) => entry.id !== matched.id)
      : entries;

    if (matched) {
      await this.maintenanceRepo.delete({ id: matched.id });
    }

    const profile = await this.equipmentProfileRepo.findOne({
      where: { equipmentId },
    });
    if (!profile) {
      return;
    }

    const patch = recomputeLastMaintenanceFields(remaining);
    await this.equipmentProfileRepo.update({ equipmentId }, patch);
  }
}
