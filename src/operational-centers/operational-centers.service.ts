import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { DestinationRate } from 'src/destination-rates/entities/destination-rate.entity';
import { serializeOperationalCenter } from 'src/common/serializers/operational-center.serializer';
import { OperationalCenter } from './entities/operational-center.entity';
import {
  hasPrimaryOperationalCenterSettingsPatch,
  type PrimaryOperationalCenterSettingsPatch,
} from './primary-operational-center-settings.patch';

@Injectable()
export class OperationalCentersService {
  constructor(
    @InjectRepository(OperationalCenter)
    private readonly repo: Repository<OperationalCenter>,
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
    @InjectRepository(DestinationRate)
    private readonly destinationRatesRepo: Repository<DestinationRate>,
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
    const company = await this.companiesRepo.findOne({ where: { id: companyId } });
    if (company) {
      const primary = await this.findExistingPrimaryCenter(company);
      if (primary) {
        await this.ensureCompanyPrimaryPointer(company, primary.id);
        return primary;
      }
    }

    let row = await this.repo.findOne({
      where: { companyId },
      order: { id: 'ASC' },
    });
    if (!row) {
      row = await this.ensureDefaultCenterForCompany(companyId);
    } else if (company) {
      await this.ensureCompanyPrimaryPointer(company, row.id);
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

  /**
   * Crea el centro default solo si no existe ninguno.
   * No sobrescribe geo de centros existentes (idempotente).
   */
  async ensureDefaultCenterForCompany(companyId: number): Promise<OperationalCenter> {
    const company = await this.companiesRepo.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }

    const existing = await this.findExistingPrimaryCenter(company);
    if (existing) {
      await this.ensureCompanyPrimaryPointer(company, existing.id);
      return existing;
    }

    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        name: 'Centro Principal',
        code: 'MAIN',
        isDefault: true,
      }),
    );

    await this.ensureCompanyPrimaryPointer(company, saved.id);
    return saved;
  }

  /** A1 write path: geo del patio se persiste en operational_centers. */
  async updatePrimaryCenterFromOperationalSettings(
    companyId: number,
    dto: PrimaryOperationalCenterSettingsPatch,
  ): Promise<OperationalCenter> {
    if (!hasPrimaryOperationalCenterSettingsPatch(dto)) {
      return this.getDefaultEntity(companyId);
    }

    const center = await this.getDefaultEntity(companyId);

    if (dto.operationalCenterPostalCode !== undefined) {
      center.postalCode = dto.operationalCenterPostalCode;
    }
    if (dto.operationalCenterCityMunicipality !== undefined) {
      center.cityMunicipality = dto.operationalCenterCityMunicipality;
    }
    if (dto.operationalCenterLocality !== undefined) {
      center.locality = dto.operationalCenterLocality;
    }
    if (dto.operationalCenterSettlementConsId !== undefined) {
      center.settlementConsId = dto.operationalCenterSettlementConsId;
    }
    if (dto.operationalCenterLatitude !== undefined) {
      center.latitude = String(dto.operationalCenterLatitude);
    }
    if (dto.operationalCenterLongitude !== undefined) {
      center.longitude = String(dto.operationalCenterLongitude);
    }
    if (dto.operationalCenterName !== undefined) {
      const trimmed = dto.operationalCenterName.trim();
      center.name = trimmed || 'Centro Principal';
    } else if (!center.name?.trim()) {
      center.name = 'Centro Principal';
    }

    const saved = await this.repo.save(center);
    const company = await this.companiesRepo.findOne({ where: { id: companyId } });
    if (company) {
      await this.ensureCompanyPrimaryPointer(company, saved.id);
    }
    await this.refreshDestinationRateOriginSnapshots(saved);
    return saved;
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

  /** Mantiene origin_* denormalizado al día cuando cambia la geo del patio. */
  async refreshDestinationRateOriginSnapshots(
    center: OperationalCenter,
  ): Promise<void> {
    const snap = this.snapshotFromCenter(center);
    await this.destinationRatesRepo.update(
      {
        companyId: center.companyId,
        originOperationalCenterId: center.id,
      },
      {
        originPostalCode: snap.originPostalCode,
        originCityMunicipality: snap.originCityMunicipality,
        originLocality: snap.originLocality,
        originLatitude: snap.originLatitude,
        originLongitude: snap.originLongitude,
      },
    );
  }

  private async findExistingPrimaryCenter(
    company: Company,
  ): Promise<OperationalCenter | null> {
    if (company.primaryOperationalCenterId) {
      const byPrimary = await this.repo.findOne({
        where: { id: company.primaryOperationalCenterId, companyId: company.id },
      });
      if (byPrimary) {
        return byPrimary;
      }
    }

    const defaultCenter = await this.repo.findOne({
      where: { companyId: company.id, isDefault: true },
    });
    if (defaultCenter) {
      return defaultCenter;
    }

    return this.repo.findOne({
      where: { companyId: company.id },
      order: { id: 'ASC' },
    });
  }

  /**
   * Fuente de verdad: companies.primary_operational_center_id.
   * is_default se mantiene como espejo para listados/FE.
   */
  private async ensureCompanyPrimaryPointer(
    company: Company,
    centerId: number,
  ): Promise<void> {
    if (company.primaryOperationalCenterId !== centerId) {
      company.primaryOperationalCenterId = centerId;
      await this.companiesRepo.save(company);
    }
    await this.repo
      .createQueryBuilder()
      .update(OperationalCenter)
      .set({ isDefault: false })
      .where('company_id = :companyId', { companyId: company.id })
      .andWhere('id <> :centerId', { centerId })
      .andWhere('is_default = true')
      .execute();
    await this.repo
      .createQueryBuilder()
      .update(OperationalCenter)
      .set({ isDefault: true })
      .where('id = :centerId', { centerId })
      .andWhere('company_id = :companyId', { companyId: company.id })
      .andWhere('is_default = false')
      .execute();
  }
}
