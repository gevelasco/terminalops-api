import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { serializeOperationalCenter } from 'src/common/serializers/operational-center.serializer';
import { OperationalCenter } from './entities/operational-center.entity';

@Injectable()
export class OperationalCentersService {
  constructor(
    @InjectRepository(OperationalCenter)
    private readonly repo: Repository<OperationalCenter>,
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
  ) {}

  async findAll(companyId: number) {
    const rows = await this.findAllEntities(companyId);
    return rows.map((row) => serializeOperationalCenter(row));
  }

  async findAllEntities(companyId: number): Promise<OperationalCenter[]> {
    return this.repo.find({
      where: { companyId },
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  async findOne(companyId: number, centerId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: centerId },
    });
    if (!row) {
      throw new NotFoundException(`Operational center ${centerId} not found`);
    }
    return serializeOperationalCenter(row);
  }

  async getDefaultEntity(companyId: number): Promise<OperationalCenter> {
    let row = await this.repo.findOne({
      where: { companyId, isDefault: true },
    });
    if (!row) {
      row = await this.repo.findOne({
        where: { companyId },
        order: { id: 'ASC' },
      });
    }
    if (!row) {
      row = await this.ensureDefaultCenterForCompany(companyId);
    }
    return row;
  }

  async resolveCenterId(
    companyId: number,
    centerId?: number,
  ): Promise<OperationalCenter> {
    if (centerId != null) {
      const row = await this.repo.findOne({
        where: { companyId, id: centerId },
      });
      if (!row) {
        throw new NotFoundException(`Operational center ${centerId} not found`);
      }
      return row;
    }
    return this.getDefaultEntity(companyId);
  }

  async ensureDefaultCenterForCompany(companyId: number): Promise<OperationalCenter> {
    const company = await this.companiesRepo.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }

    const existing = await this.repo.findOne({
      where: { companyId, isDefault: true },
    });
    if (existing) {
      if (!company.primaryOperationalCenterId) {
        company.primaryOperationalCenterId = existing.id;
        await this.companiesRepo.save(company);
      }
      return existing;
    }

    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        name: 'Centro Principal',
        code: 'MAIN',
        postalCode: company.operationalCenterPostalCode,
        cityMunicipality: company.operationalCenterCityMunicipality,
        locality: company.operationalCenterLocality,
        settlementConsId: company.operationalCenterSettlementConsId,
        latitude: company.operationalCenterLatitude,
        longitude: company.operationalCenterLongitude,
        isDefault: true,
      }),
    );

    company.primaryOperationalCenterId = saved.id;
    await this.companiesRepo.save(company);
    return saved;
  }

  async syncPrimaryFromCompanyColumns(
    company: Company,
    centerName?: string,
  ): Promise<void> {
    let center = company.primaryOperationalCenterId
      ? await this.repo.findOne({
          where: { id: company.primaryOperationalCenterId, companyId: company.id },
        })
      : null;
    if (!center) {
      center = await this.getDefaultEntity(company.id);
    }

    center.postalCode = company.operationalCenterPostalCode;
    center.cityMunicipality = company.operationalCenterCityMunicipality;
    center.locality = company.operationalCenterLocality;
    center.settlementConsId = company.operationalCenterSettlementConsId;
    center.latitude = company.operationalCenterLatitude;
    center.longitude = company.operationalCenterLongitude;
    if (centerName !== undefined) {
      const trimmed = centerName.trim();
      center.name = trimmed || 'Centro Principal';
    } else if (!center.name?.trim()) {
      center.name = 'Centro Principal';
    }
    await this.repo.save(center);

    if (!company.primaryOperationalCenterId) {
      company.primaryOperationalCenterId = center.id;
      await this.companiesRepo.save(company);
    }
  }

  snapshotFromCenter(center: OperationalCenter) {
    return {
      originPostalCode: center.postalCode?.trim() ?? '',
      originCityMunicipality: center.cityMunicipality?.trim() ?? '',
      originLocality: center.locality?.trim() ?? '',
      originLatitude: center.latitude,
      originLongitude: center.longitude,
    };
  }
}
