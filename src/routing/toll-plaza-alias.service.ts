import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  isSakbeTollPlazaNameMissing,
  formatSakbeTollPlazaName,
} from './sakbe-toll-plaza-display.util';
import type { SakbeTollPlazaRow } from './sakbe-route-tolls.parser';
import { TollPlazaAlias } from './entities/toll-plaza-alias.entity';
import { TollPlazaGlobalAlias } from './entities/toll-plaza-global-alias.entity';
import {
  builtinTollPlazaDisplayName,
  tollPlazaCatalogLookupKeys,
} from './sakbe-toll-plaza-catalog.util';

@Injectable()
export class TollPlazaAliasService {
  constructor(
    @InjectRepository(TollPlazaAlias)
    private readonly repo: Repository<TollPlazaAlias>,
    @InjectRepository(TollPlazaGlobalAlias)
    private readonly globalRepo: Repository<TollPlazaGlobalAlias>,
  ) {}

  async upsertGlobalAlias(plazaKey: string, displayName: string): Promise<void> {
    const key = plazaKey.trim().slice(0, 128);
    const name = displayName.trim().slice(0, 200);
    if (!key || !name) {
      return;
    }
    await this.globalRepo.upsert(
      { plazaKey: key, displayName: name },
      ['plazaKey'],
    );
  }

  async upsertAlias(
    companyId: number,
    plazaKey: string,
    displayName: string,
  ): Promise<void> {
    const key = plazaKey.trim().slice(0, 128);
    const name = displayName.trim().slice(0, 200);
    if (!key || !name) {
      return;
    }
    await this.repo.upsert(
      { companyId, plazaKey: key, displayName: name },
      ['companyId', 'plazaKey'],
    );
  }

  async resolvePlazaNames(
    companyId: number | undefined,
    plazas: SakbeTollPlazaRow[],
  ): Promise<SakbeTollPlazaRow[]> {
    if (plazas.length === 0) {
      return plazas;
    }
    const lookupKeys = new Set<string>();
    for (const p of plazas) {
      for (const key of tollPlazaCatalogLookupKeys({
        plazaKey: p.plazaKey,
        inegiPoint: p.inegiPoint,
      })) {
        lookupKeys.add(key);
      }
    }
    const keyList = [...lookupKeys];
    const companyLookup =
      companyId != null && Number.isFinite(companyId)
        ? this.repo.find({
            where: { companyId, plazaKey: In(plazas.map((p) => p.plazaKey)) },
          })
        : Promise.resolve([] as TollPlazaAlias[]);
    let globalRows: TollPlazaGlobalAlias[] = [];
    try {
      globalRows = await this.globalRepo.find({
        where: { plazaKey: In(keyList) },
      });
    } catch {
      globalRows = [];
    }
    const companyRows = await companyLookup;
    const byKey = new Map<string, string>();
    for (const r of globalRows) {
      byKey.set(r.plazaKey, r.displayName.trim());
    }
    for (const r of companyRows) {
      byKey.set(r.plazaKey, r.displayName.trim());
    }

    const displayNameForPlaza = (p: SakbeTollPlazaRow): string | undefined => {
      const companyExact = companyRows.find((r) => r.plazaKey === p.plazaKey)
        ?.displayName;
      if (companyExact?.trim()) {
        return companyExact.trim();
      }
      const catalogInput = {
        plazaKey: p.plazaKey,
        inegiPoint: p.inegiPoint,
      };
      for (const key of tollPlazaCatalogLookupKeys(catalogInput)) {
        const fromDb = byKey.get(key);
        if (fromDb) {
          return fromDb;
        }
      }
      return builtinTollPlazaDisplayName(catalogInput);
    };

    return plazas.map((p) => {
      const cleaned = formatSakbeTollPlazaName(p.name);
      const alias = displayNameForPlaza(p);
      const name =
        isSakbeTollPlazaNameMissing(cleaned) && alias
          ? alias
          : cleaned || alias || 'Caseta';
      return { ...p, name };
    });
  }
}