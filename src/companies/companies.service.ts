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
      if (!dto.maintenanceDateControlEnabled) {
        company.maintenanceDatePeriodDefault = undefined;
      }
    }
    if (dto.maintenanceDatePeriodDefault !== undefined) {
      company.maintenanceDatePeriodDefault = dto.maintenanceDatePeriodDefault;
    }
    if (dto.operationalCenterPostalCode !== undefined) {
      company.operationalCenterPostalCode = dto.operationalCenterPostalCode;
    }
    if (dto.operationalCenterCityMunicipality !== undefined) {
      company.operationalCenterCityMunicipality = dto.operationalCenterCityMunicipality;
    }
    if (dto.operationalCenterLocality !== undefined) {
      company.operationalCenterLocality = dto.operationalCenterLocality;
    }
    if (dto.operationalCenterSettlementConsId !== undefined) {
      company.operationalCenterSettlementConsId = dto.operationalCenterSettlementConsId;
    }
    if (dto.operationalCenterLatitude !== undefined) {
      company.operationalCenterLatitude = String(dto.operationalCenterLatitude);
    }
    if (dto.operationalCenterLongitude !== undefined) {
      company.operationalCenterLongitude = String(dto.operationalCenterLongitude);
    }
    const saved = await this.repo.save(company);
    await this.operationalCenters.syncPrimaryFromCompanyColumns(
      saved,
      dto.operationalCenterName,
    );
    return saved;
  }
}
