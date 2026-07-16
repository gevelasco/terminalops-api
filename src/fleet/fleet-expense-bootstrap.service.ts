import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Unit } from 'src/units/entities/unit.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { FleetAssetTenure } from './entities/fleet-asset-tenure.entity';
import { FleetInsuranceExpenseSyncService } from './fleet-insurance-expense-sync.service';
import { FleetGpsExpenseSyncService } from './fleet-gps-expense-sync.service';
import { FleetTenureExpenseSyncService } from './fleet-tenure-expense-sync.service';
import { Expense } from 'src/expenses/entities/expense.entity';

/**
 * One-time bootstrap that ensures all scheduled expense installments
 * (insurance, GPS, tenure) exist as real rows in the expenses table.
 *
 * Runs on every app startup but short-circuits quickly if expenses
 * already exist, so the cost is a single COUNT query per kind.
 */
@Injectable()
export class FleetExpenseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FleetExpenseBootstrapService.name);

  constructor(
    @InjectRepository(Unit) private readonly unitsRepo: Repository<Unit>,
    @InjectRepository(Equipment) private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(FleetAssetTenure) private readonly tenureRepo: Repository<FleetAssetTenure>,
    @InjectRepository(Expense) private readonly expenseRepo: Repository<Expense>,
    private readonly insuranceSync: FleetInsuranceExpenseSyncService,
    private readonly gpsSync: FleetGpsExpenseSyncService,
    private readonly tenureSync: FleetTenureExpenseSyncService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedIfNeeded();
    } catch (err) {
      this.logger.warn('Fleet expense bootstrap failed (non-fatal)', (err as Error)?.message);
    }
  }

  private async seedIfNeeded(): Promise<void> {
    const unpaidCount = await this.expenseRepo.count({
      where: [
        { kind: 'insurance', paidAt: IsNull(), discardedAt: IsNull() },
        { kind: 'gps', paidAt: IsNull(), discardedAt: IsNull() },
        { kind: 'tenure_payment' as any, paidAt: IsNull(), discardedAt: IsNull() },
      ],
    });

    if (unpaidCount > 0) {
      return;
    }

    const hasAnyConfig = await this.hasFleetWithScheduledConfig();
    if (!hasAnyConfig) {
      return;
    }

    this.logger.log('Seeding scheduled expense installments for all fleet assets…');
    await this.seedAllInstallments();
    this.logger.log('Scheduled expense seeding complete.');
  }

  private async hasFleetWithScheduledConfig(): Promise<boolean> {
    const unitWithInsurance = await this.unitsRepo
      .createQueryBuilder('u')
      .innerJoin('u.fleetProfile', 'fp')
      .where('fp.insuranceContractDate IS NOT NULL')
      .andWhere('fp.insuranceCost IS NOT NULL')
      .limit(1)
      .getCount();
    if (unitWithInsurance > 0) return true;

    const unitWithGps = await this.unitsRepo
      .createQueryBuilder('u')
      .innerJoin('u.fleetProfile', 'fp')
      .where('fp.hasGps = true')
      .andWhere('fp.gpsContractDate IS NOT NULL')
      .andWhere('fp.gpsPrice IS NOT NULL')
      .limit(1)
      .getCount();
    if (unitWithGps > 0) return true;

    const tenureCount = await this.tenureRepo.count({
      where: {
        recurringPaymentDate: Not(IsNull()),
        recurringPaymentAmount: Not(IsNull()),
        recurringInstallmentCount: Not(IsNull()),
      },
    });
    if (tenureCount > 0) return true;

    const eqWithInsurance = await this.equipmentRepo
      .createQueryBuilder('e')
      .innerJoin('e.fleetProfile', 'fp')
      .where('fp.insuranceContractDate IS NOT NULL')
      .andWhere('fp.insuranceCost IS NOT NULL')
      .limit(1)
      .getCount();
    if (eqWithInsurance > 0) return true;

    return false;
  }

  private async seedAllInstallments(): Promise<void> {
    const units = await this.unitsRepo.find({ relations: ['fleetProfile'] });
    for (const unit of units) {
      const fp = unit.fleetProfile;
      if (!fp) continue;

      if (fp.insuranceContractDate && fp.insuranceCost) {
        try {
          await this.insuranceSync.ensureAllInsuranceInstallments({
            companyId: unit.companyId,
            insuranceTarget: 'unit',
            relatedUnitId: unit.id,
            profile: fp as any,
          });
        } catch (e) {
          this.logger.warn(`Insurance sync failed for unit ${unit.id}: ${(e as Error)?.message}`);
        }
      }

      if (fp.hasGps && fp.gpsContractDate && fp.gpsPrice) {
        try {
          await this.gpsSync.ensureAllGpsInstallments({
            companyId: unit.companyId,
            relatedUnitId: unit.id,
            profile: fp as any,
          });
        } catch (e) {
          this.logger.warn(`GPS sync failed for unit ${unit.id}: ${(e as Error)?.message}`);
        }
      }
    }

    const equipment = await this.equipmentRepo.find({ relations: ['fleetProfile'] });
    for (const eq of equipment) {
      const fp = eq.fleetProfile;
      if (!fp) continue;

      if (fp.insuranceContractDate && fp.insuranceCost) {
        try {
          await this.insuranceSync.ensureAllInsuranceInstallments({
            companyId: eq.companyId,
            insuranceTarget: 'equipment',
            relatedEquipmentId: eq.id,
            profile: fp as any,
          });
        } catch (e) {
          this.logger.warn(`Insurance sync failed for equipment ${eq.id}: ${(e as Error)?.message}`);
        }
      }
    }

    const tenures = await this.tenureRepo.find();
    for (const t of tenures) {
      if (!t.recurringPaymentDate || !t.recurringPaymentAmount || !t.recurringInstallmentCount) {
        continue;
      }
      try {
        await this.tenureSync.ensureAllTenureInstallments({
          companyId: t.companyId,
          relatedUnitId: t.unitId ?? undefined,
          relatedEquipmentId: t.equipmentId ?? undefined,
          profile: t as any,
        });
      } catch (e) {
        this.logger.warn(`Tenure sync failed for tenure ${t.id}: ${(e as Error)?.message}`);
      }
    }
  }
}
