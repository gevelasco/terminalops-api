import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import {
  isExpenseVerificationScope,
  verificationProfileDate,
  verificationScopeFieldKeys,
} from 'src/expenses/expenses-verification-fleet-reconcile.util';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';

@Injectable()
export class ExpensesVerificationFleetReconcileService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(UnitFleetProfile)
    private readonly unitProfileRepo: Repository<UnitFleetProfile>,
    @InjectRepository(EquipmentFleetProfile)
    private readonly equipmentProfileRepo: Repository<EquipmentFleetProfile>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
  ) {}

  async reconcileAfterVerificationExpenseDiscard(expense: Expense): Promise<void> {
    if (expense.kind !== 'verification' || !isExpenseVerificationScope(expense.verificationScope)) {
      return;
    }

    const scope = expense.verificationScope;
    const discardedDate = formatOperationalIncurredDateYmd(expense.incurredAt);
    const keys = verificationScopeFieldKeys(scope);
    if (!keys) {
      return;
    }

    if (expense.relatedEquipmentId != null) {
      await this.reconcileEquipmentProfile({
        companyId: expense.companyId,
        equipmentId: expense.relatedEquipmentId,
        relatedUnitId: expense.relatedUnitId ?? undefined,
        scope,
        keys,
        discardedDate,
      });
      return;
    }

    if (expense.relatedUnitId == null) {
      return;
    }

    const unitReconciled = await this.reconcileUnitProfile({
      companyId: expense.companyId,
      unitId: expense.relatedUnitId,
      scope,
      keys,
      discardedDate,
    });

    if (!unitReconciled) {
      await this.reconcileEquipmentProfilesOnUnit({
        companyId: expense.companyId,
        unitId: expense.relatedUnitId,
        scope,
        keys,
        discardedDate,
      });
    }
  }

  private async reconcileUnitProfile(params: {
    companyId: number;
    unitId: number;
    scope: string;
    keys: NonNullable<ReturnType<typeof verificationScopeFieldKeys>>;
    discardedDate: string;
  }): Promise<boolean> {
    const profile = await this.unitProfileRepo.findOne({
      where: { unitId: params.unitId },
    });
    if (!profile) {
      return false;
    }

    const currentDate = verificationProfileDate(profile, params.keys);
    if (currentDate !== params.discardedDate) {
      return false;
    }

    const latest = await this.resolveLatestVerificationExpense({
      companyId: params.companyId,
      scope: params.scope,
      relatedUnitId: params.unitId,
    });

    await this.unitProfileRepo.update(
      { unitId: params.unitId },
      this.profilePatchFromExpense(latest, params.keys),
    );
    return true;
  }

  private async reconcileEquipmentProfile(params: {
    companyId: number;
    equipmentId: number;
    relatedUnitId?: number;
    scope: string;
    keys: NonNullable<ReturnType<typeof verificationScopeFieldKeys>>;
    discardedDate: string;
  }): Promise<boolean> {
    const profile = await this.equipmentProfileRepo.findOne({
      where: { equipmentId: params.equipmentId },
    });
    if (!profile) {
      return false;
    }

    const currentDate = verificationProfileDate(profile, params.keys);
    if (currentDate !== params.discardedDate) {
      return false;
    }

    const latest = await this.resolveLatestVerificationExpense({
      companyId: params.companyId,
      scope: params.scope,
      relatedUnitId: params.relatedUnitId,
      relatedEquipmentId: params.equipmentId,
    });

    await this.equipmentProfileRepo.update(
      { equipmentId: params.equipmentId },
      this.profilePatchFromExpense(latest, params.keys),
    );
    return true;
  }

  private async reconcileEquipmentProfilesOnUnit(params: {
    companyId: number;
    unitId: number;
    scope: string;
    keys: NonNullable<ReturnType<typeof verificationScopeFieldKeys>>;
    discardedDate: string;
  }): Promise<void> {
    const equipmentRows = await this.equipmentRepo.find({
      where: { companyId: params.companyId, unitId: params.unitId },
      select: ['id'],
    });
    for (const equipment of equipmentRows) {
      await this.reconcileEquipmentProfile({
        companyId: params.companyId,
        equipmentId: equipment.id,
        relatedUnitId: params.unitId,
        scope: params.scope,
        keys: params.keys,
        discardedDate: params.discardedDate,
      });
    }
  }

  private profilePatchFromExpense(
    expense: Expense | null,
    keys: NonNullable<ReturnType<typeof verificationScopeFieldKeys>>,
  ): Partial<UnitFleetProfile | EquipmentFleetProfile> {
    if (!expense) {
      return {
        [keys.dateKey]: null,
        [keys.costKey]: null,
      };
    }
    return {
      [keys.dateKey]: formatOperationalIncurredDateYmd(expense.incurredAt),
      [keys.costKey]: expense.amount,
    };
  }

  private async resolveLatestVerificationExpense(params: {
    companyId: number;
    scope: string;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
  }): Promise<Expense | null> {
    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .where('e.companyId = :companyId', { companyId: params.companyId })
      .andWhere('e.kind = :kind', { kind: 'verification' })
      .andWhere('e.discardedAt IS NULL')
      .andWhere('e.verificationScope = :scope', { scope: params.scope })
      .orderBy('e.incurredAt', 'DESC')
      .limit(1);

    if (params.relatedEquipmentId != null) {
      qb.andWhere(
        '(e.relatedEquipmentId = :relatedEquipmentId OR (e.relatedEquipmentId IS NULL AND e.relatedUnitId = :relatedUnitId))',
        {
          relatedEquipmentId: params.relatedEquipmentId,
          relatedUnitId: params.relatedUnitId ?? null,
        },
      );
    } else if (params.relatedUnitId != null) {
      qb.andWhere('e.relatedUnitId = :relatedUnitId', {
        relatedUnitId: params.relatedUnitId,
      }).andWhere('e.relatedEquipmentId IS NULL');
    } else {
      return null;
    }

    return qb.getOne();
  }
}
