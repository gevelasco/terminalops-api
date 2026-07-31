import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { AppUser } from 'src/users/entities/app-user.entity';
import { OPERATIONAL_TZ } from 'src/reports/reports-filter.util';
import {
  assertAdvancedTenureAllowed,
  assertWithinQuota,
  getPlanEntitlements,
} from './plan-entitlements';

@Injectable()
export class PlanEnforcementService {
  constructor(
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(Unit)
    private readonly units: Repository<Unit>,
    @InjectRepository(Equipment)
    private readonly equipment: Repository<Equipment>,
    @InjectRepository(Operator)
    private readonly operators: Repository<Operator>,
    @InjectRepository(Trip)
    private readonly trips: Repository<Trip>,
    @InjectRepository(AppUser)
    private readonly users: Repository<AppUser>,
  ) {}

  async assertCanAddUnit(companyId: number): Promise<void> {
    const entitlements = await this.entitlementsFor(companyId);
    const count = await this.units.count({ where: { companyId } });
    assertWithinQuota('unidades', count, entitlements.maxUnits);
  }

  async assertCanAddEquipment(companyId: number): Promise<void> {
    const entitlements = await this.entitlementsFor(companyId);
    const count = await this.equipment.count({ where: { companyId } });
    assertWithinQuota('equipos', count, entitlements.maxEquipment);
  }

  async assertCanAddOperator(companyId: number): Promise<void> {
    const entitlements = await this.entitlementsFor(companyId);
    const count = await this.operators.count({ where: { companyId } });
    assertWithinQuota('operadores', count, entitlements.maxOperators);
  }

  async assertCanAddTripThisMonth(companyId: number): Promise<void> {
    const entitlements = await this.entitlementsFor(companyId);
    if (entitlements.maxTripsPerMonth == null) {
      return;
    }
    const count = await this.countTripsThisMonth(companyId);
    assertWithinQuota(
      'maniobras este mes',
      count,
      entitlements.maxTripsPerMonth,
    );
  }

  async assertCanAddUser(
    companyId: number,
    role: string,
  ): Promise<void> {
    const entitlements = await this.entitlementsFor(companyId);
    const normalized = role.trim().toLowerCase();
    if (normalized === 'admin') {
      const count = await this.users.count({
        where: { companyId, role: 'admin' },
      });
      assertWithinQuota('administradores', count, entitlements.maxAdmins);
      return;
    }
    if (normalized === 'staff') {
      const count = await this.users.count({
        where: { companyId, role: 'staff' },
      });
      assertWithinQuota('usuarios staff', count, entitlements.maxStaffUsers);
    }
  }

  async assertTenureAllowed(
    companyId: number,
    tenureMode: string | null | undefined,
  ): Promise<void> {
    const plan = await this.planRaw(companyId);
    assertAdvancedTenureAllowed(plan, tenureMode);
  }

  private async entitlementsFor(companyId: number) {
    return getPlanEntitlements(await this.planRaw(companyId));
  }

  private async planRaw(companyId: number): Promise<string | null> {
    const company = await this.companies.findOne({
      where: { id: companyId },
      select: [
        'id',
        'subscriptionPlan',
        'subscriptionStatus',
        'subscriptionEndsAt',
      ],
    });
    if (!company) {
      return null;
    }
    const status = (company.subscriptionStatus ?? 'active').toLowerCase();
    if (status === 'cancelled' || status === 'past_due' || status === 'expired') {
      return 'basic';
    }
    const endsAt = company.subscriptionEndsAt;
    if (endsAt && new Date(endsAt).getTime() < Date.now()) {
      // Licencia vencida: aplicar cupos/features de Básico.
      return 'basic';
    }
    return company.subscriptionPlan ?? null;
  }

  private async countTripsThisMonth(companyId: number): Promise<number> {
    const raw = await this.trips
      .createQueryBuilder('trip')
      .where('trip.companyId = :companyId', { companyId })
      .andWhere('trip.deletedAt IS NULL')
      .andWhere(
        `date_trunc('month', trip.createdAt AT TIME ZONE :tz) = date_trunc('month', NOW() AT TIME ZONE :tz)`,
        { tz: OPERATIONAL_TZ },
      )
      .getCount();
    return raw;
  }
}
