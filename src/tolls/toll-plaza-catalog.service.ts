import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TollPlaza } from './entities/toll-plaza.entity';
import {
  tollPlazaCatalogKey,
  tollPlazaCostMxnForAxles,
} from './toll-plaza-price.util';

/** Pares 1:1 para `translate()` en Postgres (sin extensión unaccent). */
const ACCENT_FROM =
  'áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ';
const ACCENT_TO =
  'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC';

function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export type TollPlazaSearchHit = {
  plazaKey: string;
  name: string;
  section: string | null;
  lat: number;
  lng: number;
  inegiPoint: string;
  costMxn: number | null;
  /** Costos camión por ejes 2–9 para recalcular en FE al cambiar ejes. */
  costsByAxle: Record<string, number | null>;
};

@Injectable()
export class TollPlazaCatalogService {
  constructor(
    @InjectRepository(TollPlaza)
    private readonly repo: Repository<TollPlaza>,
  ) {}

  /** Catálogo completo (~1k filas); lectura directa, sin caché. */
  getAll(): Promise<TollPlaza[]> {
    return this.repo.find({ order: { plazaId: 'ASC' } });
  }

  /**
   * Autocomplete por nombre o sección (mín. 3 caracteres recomendado en FE).
   * Insensible a mayúsculas y acentos (León ↔ leon).
   */
  async search(query: string, axleCount = 5, limit = 20): Promise<TollPlazaSearchHit[]> {
    const q = foldSearchText(query);
    if (q.length < 2) {
      return [];
    }
    const take = Math.min(Math.max(limit, 1), 40);
    const pattern = `%${q.replace(/[%_]/g, '')}%`;
    const foldedName =
      'translate(lower(coalesce(p.name, \'\')), :accentFrom, :accentTo)';
    const foldedSection =
      'translate(lower(coalesce(p.section, \'\')), :accentFrom, :accentTo)';
    const rows = await this.repo
      .createQueryBuilder('p')
      .where(`${foldedName} LIKE :pattern`)
      .orWhere(`${foldedSection} LIKE :pattern`)
      .setParameters({
        pattern,
        accentFrom: ACCENT_FROM,
        accentTo: ACCENT_TO,
      })
      .orderBy('p.name', 'ASC')
      .addOrderBy('p.plaza_id', 'ASC')
      .take(take)
      .getMany();
    return rows.map((row) => this.toSearchHit(row, axleCount));
  }

  private toSearchHit(row: TollPlaza, axleCount: number): TollPlazaSearchHit {
    const costsByAxle: Record<string, number | null> = {};
    for (let ax = 2; ax <= 9; ax += 1) {
      costsByAxle[String(ax)] = tollPlazaCostMxnForAxles(row, ax);
    }
    return {
      plazaKey: tollPlazaCatalogKey(row.plazaId),
      name: row.name?.trim() || `Plaza ${row.plazaId}`,
      section: row.section?.trim() || null,
      lat: row.lat,
      lng: row.lng,
      inegiPoint: `${row.lat},${row.lng}`,
      costMxn: tollPlazaCostMxnForAxles(row, axleCount),
      costsByAxle,
    };
  }
}
