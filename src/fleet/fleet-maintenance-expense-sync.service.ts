import { Injectable } from '@nestjs/common';
import { ExpensesService } from 'src/expenses/expenses.service';
import type { ExpenseMaintenanceTarget } from 'src/expenses/expense-payload.util';
import {
  findNewBillableMaintenanceEntries,
  type MaintenanceEntryLike,
} from './fleet-maintenance-expense-sync.util';

@Injectable()
export class FleetMaintenanceExpenseSyncService {
  constructor(private readonly expensesService: ExpensesService) {}

  async syncForMaintenanceSave(params: {
    companyId: number;
    /** @deprecated derivado de related IDs */
    maintenanceTarget?: ExpenseMaintenanceTarget;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    previous: MaintenanceEntryLike[];
    incoming: MaintenanceEntryLike[];
  }): Promise<void> {
    const newEntries = findNewBillableMaintenanceEntries(
      params.previous,
      params.incoming,
    );
    for (const entry of newEntries) {
      const date = (entry.date ?? entry.entryDate ?? '').trim();
      if (!date) {
        continue;
      }
      const type = (entry.type ?? entry.entryType ?? '').trim();
      const amount = Number(entry.cost);
      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }
      const notes = entry.notes?.trim();
      const paymentMethod = entry.paymentMethod?.trim();
      await this.expensesService.create(params.companyId, {
        category: type || 'Mantenimiento',
        amount,
        incurredAt: date,
        kind: 'maintenance',
        relatedUnitId:
          params.relatedUnitId != null ? String(params.relatedUnitId) : undefined,
        relatedEquipmentId:
          params.relatedEquipmentId != null
            ? String(params.relatedEquipmentId)
            : undefined,
        description: notes || (type ? `Mantenimiento: ${type}` : 'Mantenimiento'),
        ...(paymentMethod ? { paymentMethod } : {}),
      });
    }
  }
}
