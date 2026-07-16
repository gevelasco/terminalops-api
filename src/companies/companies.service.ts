import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { assertCompanyAccess } from '../common/utils/tenant.util';
import AuthUser from '../types/auth-user.type';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { OperationalCentersService } from '../operational-centers/operational-centers.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyOperationalSettingsDto } from './dto/update-company-operational-settings.dto';
import { normalizeExpensePaymentMethod } from 'src/expenses/expense-payment-method.util';

function roundDieselPrice(n: number): number {
  return Math.round(n * 10000) / 10000;
}

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly repo: Repository<Company>,
    private readonly tenantContext: TenantContextService,
    private readonly operationalCenters: OperationalCentersService,
  ) {}

  async create(dto: CreateCompanyDto) {
    const now = new Date();
    const saved = await this.repo.save(
      this.repo.create({
        name: dto.name,
        legalName: dto.legalName,
        subscriptionStatus: 'active',
        operationalAnalysisEnabled: true,
        operationalAnalysisChangedAt: now,
        tripAssistPrefillEnabled: false,
        tripAutoMaintenanceProvisionPercent: '5',
        tripAutoFuelPaymentMethod: 'cash',
        tripAutoTollsPaymentMethod: 'cash',
        tripAutoPerDiemPaymentMethod: 'cash',
        tripAutoControlPaymentMethod: 'cash',
        dieselControlEnabled: true,
        dieselControlChangedAt: now,
      }),
    );
    const fresh = await this.repo.findOne({ where: { id: saved.id } });
    const company = fresh ?? saved;
    await this.operationalCenters.ensureDefaultCenterForCompany(company.id);
    return company;
  }

  async findOne(id: number) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return row;
  }

  async findById(id: number) {
    return this.findOne(id);
  }

  async resolveInternalId(companyId: number): Promise<number | null> {
    return this.tenantContext.resolveInternalId(companyId);
  }

  async assertAccessAndResolve(
    user: AuthUser,
    companyId: number,
  ): Promise<number> {
    return this.tenantContext.assertAccessAndResolve(user, companyId);
  }

  async resolveInternalIdFromAuthUser(user: AuthUser): Promise<number> {
    return this.tenantContext.resolveInternalIdFromAuthUser(user);
  }

  async updateOperationalSettings(
    user: AuthUser,
    companyId: number,
    dto: UpdateCompanyOperationalSettingsDto,
  ) {
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      throw new ForbiddenException('Solo administradores pueden cambiar la configuración operativa');
    }
    const company = await this.findOne(companyId);
    assertCompanyAccess(user, companyId);
    if (dto.operationalAnalysisEnabled !== undefined) {
      company.operationalAnalysisEnabled = dto.operationalAnalysisEnabled;
      company.operationalAnalysisChangedAt = new Date();
    }
    if (dto.tripAssistPrefillEnabled !== undefined) {
      if (company.tripAssistPrefillEnabled !== dto.tripAssistPrefillEnabled) {
        company.tripAssistPrefillChangedAt = new Date();
      }
      company.tripAssistPrefillEnabled = dto.tripAssistPrefillEnabled;
    }
    if (dto.tripAutoMaintenanceProvisionPercent !== undefined) {
      company.tripAutoMaintenanceProvisionPercent = String(
        dto.tripAutoMaintenanceProvisionPercent,
      );
    }
    if (dto.tripAutoFuelPaymentMethod !== undefined) {
      company.tripAutoFuelPaymentMethod = normalizeExpensePaymentMethod(
        dto.tripAutoFuelPaymentMethod,
      );
    }
    if (dto.tripAutoTollsPaymentMethod !== undefined) {
      company.tripAutoTollsPaymentMethod = normalizeExpensePaymentMethod(
        dto.tripAutoTollsPaymentMethod,
      );
    }
    if (dto.tripAutoPerDiemPaymentMethod !== undefined) {
      company.tripAutoPerDiemPaymentMethod = normalizeExpensePaymentMethod(
        dto.tripAutoPerDiemPaymentMethod,
      );
    }
    if (dto.tripAutoControlPaymentMethod !== undefined) {
      company.tripAutoControlPaymentMethod = normalizeExpensePaymentMethod(
        dto.tripAutoControlPaymentMethod,
      );
    }
    if (dto.dieselControlEnabled !== undefined) {
      if (company.dieselControlEnabled !== dto.dieselControlEnabled) {
        company.dieselControlChangedAt = new Date();
      }
      company.dieselControlEnabled = dto.dieselControlEnabled;
    }
    if (dto.maintenanceKmControlEnabled !== undefined) {
      if (company.maintenanceKmControlEnabled !== dto.maintenanceKmControlEnabled) {
        company.maintenanceKmControlChangedAt = new Date();
      }
      company.maintenanceKmControlEnabled = dto.maintenanceKmControlEnabled;
      if (dto.maintenanceKmControlEnabled) {
        company.maintenanceDateControlEnabled = false;
        company.maintenanceDatePeriodDefault = undefined;
      }
      if (!dto.maintenanceKmControlEnabled) {
        company.maintenanceKmIntervalDefault = undefined;
      }
    }
    if (dto.maintenanceKmIntervalDefault !== undefined) {
      company.maintenanceKmIntervalDefault = String(dto.maintenanceKmIntervalDefault);
    }
    if (dto.maintenanceDateControlEnabled !== undefined) {
      if (company.maintenanceDateControlEnabled !== dto.maintenanceDateControlEnabled) {
        company.maintenanceDateControlChangedAt = new Date();
      }
      company.maintenanceDateControlEnabled = dto.maintenanceDateControlEnabled;
      if (dto.maintenanceDateControlEnabled) {
        company.maintenanceKmControlEnabled = false;
        company.maintenanceKmIntervalDefault = undefined;
      }
      if (!dto.maintenanceDateControlEnabled) {
        company.maintenanceDatePeriodDefault = undefined;
      }
    }
    if (dto.maintenanceDatePeriodDefault !== undefined) {
      company.maintenanceDatePeriodDefault = dto.maintenanceDatePeriodDefault;
    }

    const saved = await this.repo.save(company);
    const primaryCenter =
      await this.operationalCenters.updatePrimaryCenterFromOperationalSettings(
        companyId,
        {
          operationalCenterName: dto.operationalCenterName,
          operationalCenterPostalCode: dto.operationalCenterPostalCode,
          operationalCenterCityMunicipality: dto.operationalCenterCityMunicipality,
          operationalCenterLocality: dto.operationalCenterLocality,
          operationalCenterSettlementConsId: dto.operationalCenterSettlementConsId,
          operationalCenterLatitude: dto.operationalCenterLatitude,
          operationalCenterLongitude: dto.operationalCenterLongitude,
        },
      );
    if (primaryCenter.id !== saved.primaryOperationalCenterId) {
      saved.primaryOperationalCenterId = primaryCenter.id;
    }
    return saved;
  }

  async updateDieselReferencePrice(
    user: AuthUser,
    companyId: number,
    pricePerLiter: number,
  ): Promise<Company> {
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      throw new ForbiddenException(
        'Solo administradores pueden actualizar el precio de referencia de diésel',
      );
    }
    const company = await this.findOne(companyId);
    assertCompanyAccess(user, companyId);
    if (!company.dieselControlEnabled) {
      throw new ForbiddenException(
        'El control de diésel está desactivado para esta empresa',
      );
    }

    const now = new Date();
    company.dieselReferencePricePerLiter = String(roundDieselPrice(pricePerLiter));
    company.dieselReferencePriceUpdatedAt = now;
    const userId = Number.parseInt(user.id, 10);
    company.dieselReferencePriceUpdatedByUserId =
      Number.isFinite(userId) && userId > 0 ? userId : undefined;

    return this.repo.save(company);
  }

  async updateAccountInfo(
    user: AuthUser,
    companyId: number,
    data: { name?: string; tagline?: string },
  ) {
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      throw new ForbiddenException('Solo administradores pueden editar la información de la empresa');
    }
    const company = await this.findOne(companyId);
    assertCompanyAccess(user, companyId);

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw new ForbiddenException('El nombre de la empresa no puede estar vacío');
      }
      company.name = trimmed;
    }
    if (data.tagline !== undefined) {
      company.tagline = data.tagline.trim() || undefined;
    }
    return this.repo.save(company);
  }
}
