import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { normalizeFleetBrandName } from 'src/fleet/utils/fleet-brand-normalize.util';
import { TripLoadPlace } from 'src/trips/entities/trip-load-place.entity';

/** Lugares de carga por empresa: mismo patrón que el catálogo de marcas de flota. */
@Injectable()
export class TripLoadPlacesService {
  constructor(
    @InjectRepository(TripLoadPlace)
    private readonly repo: Repository<TripLoadPlace>,
  ) {}

  async listNames(companyId: number): Promise<{ places: string[] }> {
    const rows = await this.repo.find({
      where: { companyId, isActive: true },
      order: { name: 'ASC' },
    });
    return { places: rows.map((row) => row.name) };
  }

  /** Alta idempotente al guardar una maniobra con lugar de carga nuevo. */
  async findOrCreate(
    companyId: number,
    rawName: string | undefined,
  ): Promise<TripLoadPlace | null> {
    const normalized = normalizeFleetBrandName(rawName ?? '');
    if (!normalized) {
      return null;
    }

    const existing = await this.repo.findOne({
      where: { companyId, nameNormalized: normalized.nameNormalized },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.repo.save(
        this.repo.create({
          companyId,
          name: normalized.name,
          nameNormalized: normalized.nameNormalized,
          isActive: true,
        }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const raced = await this.repo.findOne({
          where: { companyId, nameNormalized: normalized.nameNormalized },
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as { code?: string };
    return driverError?.code === '23505';
  }
}
