import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TollPlazaAlias } from './entities/toll-plaza-alias.entity';
import { TollPlazaGlobalAlias } from './entities/toll-plaza-global-alias.entity';

/** Alias opcionales de nombre para claves `plaza:{id}` del catálogo propio. */
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
}
