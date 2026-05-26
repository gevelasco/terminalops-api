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
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyOperationalSettingsDto } from './dto/update-company-operational-settings.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly repo: Repository<Company>,
    private readonly tenantContext: TenantContextService,
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
      }),
    );
    const fresh = await this.repo.findOne({ where: { id: saved.id } });
    return fresh ?? saved;
  }

  async findOne(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return row;
  }

  async findByPublicId(publicId: number) {
    const row = await this.repo.findOne({ where: { publicId } });
    if (!row) {
      throw new NotFoundException(`Company ${publicId} not found`);
    }
    return row;
  }

  async resolveInternalId(publicId: number): Promise<string | null> {
    return this.tenantContext.resolveInternalId(publicId);
  }

  async assertAccessAndResolve(
    user: AuthUser,
    publicCompanyId: number,
  ): Promise<string> {
    return this.tenantContext.assertAccessAndResolve(user, publicCompanyId);
  }

  async resolveInternalIdFromAuthUser(user: AuthUser): Promise<string> {
    return this.tenantContext.resolveInternalIdFromAuthUser(user);
  }

  async updateOperationalSettings(
    user: AuthUser,
    publicCompanyId: number,
    dto: UpdateCompanyOperationalSettingsDto,
  ) {
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      throw new ForbiddenException('Solo administradores pueden cambiar la configuración operativa');
    }
    const company = await this.findByPublicId(publicCompanyId);
    assertCompanyAccess(user, publicCompanyId);
    if (dto.operationalAnalysisEnabled !== undefined) {
      company.operationalAnalysisEnabled = dto.operationalAnalysisEnabled;
      company.operationalAnalysisChangedAt = new Date();
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
    return saved;
  }
}
