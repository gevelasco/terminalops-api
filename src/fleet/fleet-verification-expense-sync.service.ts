import { Injectable } from '@nestjs/common';
import { ExpensesService } from 'src/expenses/expenses.service';
import {
  type ExpenseVerificationScope,
  verificationScopeFromExpenseText,
} from 'src/expenses/expense-payload.util';
import {
  formatOperationalIncurredDateYmd,
} from 'src/expenses/expenses-incurred-at.util';
import {
  findNewBillableVerificationEvents,
  VERIFICATION_SCOPE_SPECS,
  type VerificationExpenseCandidate,
} from './fleet-verification-expense-sync.util';
import {
  fleetModelTwoYearExemptionEndYmd,
  isWithinFleetModelTwoYearExemption,
} from './fleet-verification-exemption.util';

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
    unitId?: number;
    equipmentId: number;
    previous: UnitFleetProfileLike;
    incoming: UnitFleetMetaLike;
  }): Promise<void> {
    const events = findNewBillableVerificationEvents(params.previous, params.incoming, [
      'phys_mech',
      'double_articulated',
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

  async clearVerificationScope(params: {
    companyId: number;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    scope: ExpenseVerificationScope;
    lastVerificationYmd?: string | null;
  }): Promise<void> {
    const fromYmd = params.lastVerificationYmd?.trim();
    if (!fromYmd) {
      return;
    }
    await this.expensesService.discardUnpaidVerificationFromYmd({
      companyId: params.companyId,
      relatedUnitId: params.relatedUnitId,
      relatedEquipmentId: params.relatedEquipmentId,
      scope: params.scope,
      fromYmd,
    });
  }

  /**
   * Modelos nuevos: primer cargo de físico-mecánica / emisiones al terminar
   * la exención de 2 años, aunque la fecha esté lejos. Idempotente.
   */
  async ensureExemptionVerificationExpenses(params: {
    companyId: number;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    trailerYear?: string | number | null;
    previous: UnitFleetProfileLike;
    scopes: readonly ExpenseVerificationScope[];
  }): Promise<void> {
    if (params.relatedUnitId == null && params.relatedEquipmentId == null) {
      return;
    }
    const firstDue = fleetModelTwoYearExemptionEndYmd(params.trailerYear);
    if (!firstDue) {
      return;
    }
    const todayYmd = formatOperationalIncurredDateYmd(new Date());
    if (!isWithinFleetModelTwoYearExemption(params.trailerYear, todayYmd)) {
      return;
    }

    const existing = await this.expensesService.findScheduledExpenses(
      params.companyId,
      'verification',
      {
        relatedUnitId: params.relatedUnitId,
        relatedEquipmentId: params.relatedEquipmentId,
      },
    );

    for (const scope of params.scopes) {
      const spec = VERIFICATION_SCOPE_SPECS.find((row) => row.scope === scope);
      if (!spec) {
        continue;
      }
      const previousDate = String(
        (params.previous?.[spec.dateKey] as string | null | undefined) ?? '',
      ).trim();
      if (previousDate) {
        continue;
      }
      const alreadyHasScope = existing.some(
        (row) =>
          verificationScopeFromExpenseText(row.category, row.description) === scope,
      );
      if (alreadyHasScope) {
        continue;
      }

      await this.createVerificationExpense({
        companyId: params.companyId,
        relatedUnitId: params.relatedUnitId,
        relatedEquipmentId: params.relatedEquipmentId,
        event: {
          scope,
          date: firstDue,
          cost: 0,
          category: spec.category,
        },
      });
    }
  }

  private async createVerificationExpense(params: {
    companyId: number;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    event: VerificationExpenseCandidate;
  }): Promise<void> {
    if (params.relatedUnitId == null && params.relatedEquipmentId == null) {
      return;
    }
    const existing = await this.expensesService.findActiveVerificationOnDate({
      companyId: params.companyId,
      relatedUnitId: params.relatedUnitId,
      relatedEquipmentId: params.relatedEquipmentId,
      scope: params.event.scope,
      incurredYmd: params.event.date,
    });
    if (!existing) {
      await this.expensesService.create(params.companyId, {
        category: params.event.category,
        amount: params.event.cost,
        incurredAt: params.event.date,
        kind: 'verification',
        verificationScope: params.event.scope,
        ...(params.relatedUnitId != null
          ? { relatedUnitId: String(params.relatedUnitId) }
          : {}),
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
      return;
    }
    await this.expensesService.ensureNextVerificationInstallment({
      companyId: params.companyId,
      relatedUnitId: params.relatedUnitId,
      relatedEquipmentId: params.relatedEquipmentId,
      scope: params.event.scope,
      lastVerificationYmd: params.event.date,
      amount: params.event.cost,
      category: params.event.category,
      description: existing.description,
    });
  }
}
