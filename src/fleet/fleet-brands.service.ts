import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  FleetBrand,
  type FleetBrandType,
} from 'src/fleet/entities/fleet-brand.entity';
import { FleetBrandVersion } from 'src/fleet/entities/fleet-brand-version.entity';
import type { FleetCatalogResponseDto } from 'src/fleet/dto/fleet-catalog.dto';
import { normalizeFleetBrandName } from 'src/fleet/utils/fleet-brand-normalize.util';

@Injectable()
export class FleetBrandsService {
  constructor(
    @InjectRepository(FleetBrand)
    private readonly brandRepo: Repository<FleetBrand>,
    @InjectRepository(FleetBrandVersion)
    private readonly versionRepo: Repository<FleetBrandVersion>,
  ) {}

  async listCatalog(companyId: number): Promise<FleetCatalogResponseDto> {
    const rows = await this.brandRepo.find({
      where: { companyId, isActive: true },
      relations: ['versions'],
      order: { name: 'ASC' },
    });
    return {
      brands: rows.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        versions: (row.versions ?? [])
          .filter((v) => v.isActive)
          .sort((a, b) => a.name.localeCompare(b.name, 'es'))
          .map((version) => ({
            id: version.id,
            name: version.name,
          })),
      })),
    };
  }

  async findOrCreateBrand(
    companyId: number,
    type: FleetBrandType,
    rawName: string,
  ): Promise<FleetBrand | null> {
    const normalized = normalizeFleetBrandName(rawName);
    if (!normalized) {
      return null;
    }

    const existing = await this.brandRepo.findOne({
      where: {
        companyId,
        type,
        nameNormalized: normalized.nameNormalized,
      },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.brandRepo.save(
        this.brandRepo.create({
          companyId,
          type,
          name: normalized.name,
          nameNormalized: normalized.nameNormalized,
          isActive: true,
        }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const raced = await this.brandRepo.findOne({
          where: {
            companyId,
            type,
            nameNormalized: normalized.nameNormalized,
          },
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  async findOrCreateVersion(
    brandId: number,
    rawName: string,
  ): Promise<FleetBrandVersion | null> {
    const normalized = normalizeFleetBrandName(rawName);
    if (!normalized) {
      return null;
    }

    const existing = await this.versionRepo.findOne({
      where: {
        brandId,
        nameNormalized: normalized.nameNormalized,
      },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.versionRepo.save(
        this.versionRepo.create({
          brandId,
          name: normalized.name,
          nameNormalized: normalized.nameNormalized,
          isActive: true,
        }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const raced = await this.versionRepo.findOne({
          where: {
            brandId,
            nameNormalized: normalized.nameNormalized,
          },
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  /** @deprecated use findOrCreateBrand */
  async findOrCreate(
    companyId: number,
    type: FleetBrandType,
    rawName: string,
  ): Promise<FleetBrand | null> {
    return this.findOrCreateBrand(companyId, type, rawName);
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as { code?: string };
    return driverError?.code === '23505';
  }
}
