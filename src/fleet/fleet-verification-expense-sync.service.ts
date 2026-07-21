import { Injectable } from '@nestjs/common';
import { ExpensesService } from 'src/expenses/expenses.service';
import {
  findNewBillableVerificationEvents,
  type VerificationExpenseCandidate,
} from './fleet-verification-expense-sync.util';

type UnitFleetProfileLike = Parameters<typeof findNewBillableVerificationEvents>[0];
type UnitFleetMetaLike = Parameters<typeof findNewBillableVerificationEvents>[1];

@Injectable()
export class FleetVerificationExpenseSyncService {
  constructor(private readonly expensesService: ExpensesService) {}

  async syncForUnitVerificationSave(params: {
    companyId: number;
    unitId: number;
    previous: UnitFleetProfileLike;
    incoming: UnitFleetMetaLike;
    scopes?: Parameters<typeof findNewBillableVerificationEvents>[2];
  }): Promise<void> {
    const events = findNewBillableVerificationEvents(
      params.previous,
      params.incoming,
      params.scopes,
    );
    for (const event of events) {
      await this.createVerificationExpense({
        companyId: params.companyId,
        relatedUnitId: params.unitId,
        event,
      });
    }
  }

  async syncForEquipmentVerificationSave(params: {
    companyId: number;
    unitId: number;
    equipmentId: number;
    previous: UnitFleetProfileLike;
    incoming: UnitFleetMetaLike;
  }): Promise<void> {
    const events = findNewBillableVerificationEvents(params.previous, params.incoming, [
      'phys_mech',
    ]);
    for (const event of events) {
      await this.createVerificationExpense({
        companyId: params.companyId,
        relatedUnitId: params.unitId,
        relatedEquipmentId: params.equipmentId,
        event,
      });
    }
  }

  private async createVerificationExpense(params: {
    companyId: number;
    relatedUnitId: number;
    relatedEquipmentId?: number;
    event: VerificationExpenseCandidate;
  }): Promise<void> {
    await this.expensesService.create(params.companyId, {
      category: params.event.category,
      amount: params.event.cost,
      incurredAt: params.event.date,
      kind: 'verification',
      verificationScope: params.event.scope,
      relatedUnitId: String(params.relatedUnitId),
      ...(params.relatedEquipmentId != null
        ? { relatedEquipmentId: String(params.relatedEquipmentId) }
        : {}),
      description: `Pago de verificación - ${
        params.event.scope === 'phys_mech'
          ? 'físico-mecánica'
          : params.event.scope === 'emissions'
            ? 'emisiones'
            : 'doble articulado'
      }`,
    });
  }
}
