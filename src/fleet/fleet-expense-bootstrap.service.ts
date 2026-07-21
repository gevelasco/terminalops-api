import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { Unit } from 'src/units/entities/unit.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { FleetAssetTenure } from './entities/fleet-asset-tenure.entity';
import { FleetInsuranceExpenseSyncService } from './fleet-insurance-expense-sync.service';
import { FleetGpsExpenseSyncService } from './fleet-gps-expense-sync.service';
import { FleetTenureExpenseSyncService } from './fleet-tenure-expense-sync.service';
import { Expense } from 'src/expenses/entities/expense.entity';

/** Advisory lock global: solo una instancia siembra a la vez en el deploy. */
const FLEET_BOOTSTRAP_LOCK_KEY = 74_027_003;

/**
 * Bootstrap que asegura que las cuotas programadas (seguro, GPS, financiamiento)
 * existan como filas reales en `expenses`.
 *
 * Corre en cada arranque, pero:
 * - Toma un advisory lock, así solo una instancia siembra (las demás salen).
 * - Evalúa POR COMPAÑÍA: una compañía se siembra solo si tiene configuración
 *   de flota programada y aún no tiene cuotas programadas. Así una compañía
 *   nueva sí se siembra aunque otras ya estén sembradas (antes el corte era
 *   global y las nuevas quedaban sin cuotas).
 */
@Injectable()
export class FleetExpenseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FleetExpenseBootstrapService.name);

  constructor(
    @InjectRepository(Unit) private readonly unitsRepo: Repository<Unit>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(FleetAssetTenure)
    private readonly tenureRepo: Repository<FleetAssetTenure>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    private readonly insuranceSync: FleetInsuranceExpenseSyncService,
    private readonly gpsSync: FleetGpsExpenseSyncService,
    private readonly tenureSync: FleetTenureExpenseSyncService,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const lockAcquired = await this.tryAcquireLock();
    if (!lockAcquired) {
      this.logger.debug(
        'Fleet expense bootstrap skipped: advisory lock held by another instance',
      );
      return;
    }
    try {
      await this.seedIfNeeded();
    } catch (err) {
      this.logger.warn(
        'Fleet expense bootstrap failed (non-fatal)',
        (err as Error)?.message,
      );
    } finally {
      await this.releaseLock();
    }
  }

  private async tryAcquireLock(): Promise<boolean> {
    try {
      const rows = await this.dataSource.query(
        `SELECT pg_try_advisory_lock($1) AS acquired`,
        [FLEET_BOOTSTRAP_LOCK_KEY],
      );
      return Boolean(rows?.[0]?.acquired);
    } catch {
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [
        FLEET_BOOTSTRAP_LOCK_KEY,
      ]);
    } catch {
      // best-effort: el lock se libera igual al cerrar la sesión.
    }
  }

  private async seedIfNeeded(): Promise<void> {
    const companyIds = await this.companiesWithScheduledConfig();
    if (companyIds.length === 0) {
      return;
    }

    for (const companyId of companyIds) {
      try {
        const alreadySeeded = await this.companyHasScheduledExpenses(companyId);
        if (alreadySeeded) {
          continue;
        }
        this.logger.log(
          `Seeding scheduled expense installments for company ${companyId}…`,
        );
        await this.seedCompanyInstallments(companyId);
      } catch (err) {
        this.logger.warn(
          `Fleet expense bootstrap failed for company ${companyId} (non-fatal): ${
            (err as Error)?.message
          }`,
        );
      }
    }
  }

  /** Compañías con al menos un activo/tenencia con calendario programado. */
  private async companiesWithScheduledConfig(): Promise<number[]> {
    const ids = new Set<number>();

    const collect = (rows: Array<{ companyId: number | string }>) => {
      for (const row of rows) {
        ids.add(Number(row.companyId));
      }
    };

    collect(
      await this.unitsRepo
        .createQueryBuilder('u')
        .select('DISTINCT u.company_id', 'companyId')
        .innerJoin('u.fleetProfile', 'fp')
        .where(
          `(
            (fp.insuranceContractDate IS NOT NULL AND fp.insuranceCost IS NOT NULL)
            OR (fp.hasGps = true AND fp.gpsContractDate IS NOT NULL AND fp.gpsPrice IS NOT NULL)
          )`,
        )
        .getRawMany<{ companyId: number | string }>(),
    );

    collect(
      await this.equipmentRepo
        .createQueryBuilder('e')
        .select('DISTINCT e.company_id', 'companyId')
        .innerJoin('e.fleetProfile', 'fp')
        .where(
          'fp.insuranceContractDate IS NOT NULL AND fp.insuranceCost IS NOT NULL',
        )
        .getRawMany<{ companyId: number | string }>(),
    );

    collect(
      await this.tenureRepo
        .createQueryBuilder('t')
        .select('DISTINCT t.company_id', 'companyId')
        .where('t.recurringPaymentDate IS NOT NULL')
        .andWhere('t.recurringPaymentAmount IS NOT NULL')
        .andWhere('t.recurringInstallmentCount IS NOT NULL')
        .getRawMany<{ companyId: number | string }>(),
    );

    return [...ids];
  }

  private async companyHasScheduledExpenses(
    companyId: number,
  ): Promise<boolean> {
    const count = await this.expenseRepo.count({
      where: [
        { companyId, kind: 'insurance', discardedAt: IsNull() },
        { companyId, kind: 'gps', discardedAt: IsNull() },
        { companyId, kind: 'tenure_payment', discardedAt: IsNull() },
      ],
    });
    return count > 0;
  }

  private async seedCompanyInstallments(companyId: number): Promise<void> {
    const units = await this.unitsRepo.find({
      where: { companyId },
      relations: ['fleetProfile'],
    });
    for (const unit of units) {
      const fp = unit.fleetProfile;
      if (!fp) continue;

      if (fp.insuranceContractDate && fp.insuranceCost) {
        await this.insuranceSync.ensureAllInsuranceInstallments({
          companyId,
                    relatedUnitId: unit.id,
          profile: fp,
        });
      }

      if (fp.hasGps && fp.gpsContractDate && fp.gpsPrice) {
        await this.gpsSync.ensureAllGpsInstallments({
          companyId,
          relatedUnitId: unit.id,
          profile: fp,
        });
      }
    }

    const equipment = await this.equipmentRepo.find({
      where: { companyId },
      relations: ['fleetProfile'],
    });
    for (const eq of equipment) {
      const fp = eq.fleetProfile;
      if (!fp) continue;

      if (fp.insuranceContractDate && fp.insuranceCost) {
        await this.insuranceSync.ensureAllInsuranceInstallments({
          companyId,
                    relatedEquipmentId: eq.id,
          profile: fp,
        });
      }
    }

    const tenures = await this.tenureRepo.find({ where: { companyId } });
    for (const t of tenures) {
      if (
        !t.recurringPaymentDate ||
        !t.recurringPaymentAmount ||
        !t.recurringInstallmentCount
      ) {
        continue;
      }
      await this.tenureSync.ensureAllTenureInstallments({
        companyId,
        relatedUnitId: t.unitId ?? undefined,
        relatedEquipmentId: t.equipmentId ?? undefined,
        profile: t,
      });
    }
  }
}
