import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  isDestinationRateScopeCoarsening,
  normalizeDestinationRateScope,
  normalizePlaceKey,
  parseCityMunicipalityLine,
  type DestinationRateScope,
} from 'src/common/constants/destination-rate-scope';
import { ClientDelivery } from 'src/clients/entities/client-delivery.entity';
import { DestinationRate } from './entities/destination-rate.entity';
import { DestinationRatePrice } from './entities/destination-rate-price.entity';

function maxMoney(a: string | undefined, b: string | undefined): string {
  const na = Number(a ?? 0);
  const nb = Number(b ?? 0);
  const best = Math.max(
    Number.isFinite(na) ? na : 0,
    Number.isFinite(nb) ? nb : 0,
  );
  return String(best);
}

function groupKeyForScope(
  rate: DestinationRate,
  scope: DestinationRateScope,
): string {
  const origin = rate.originOperationalCenterId;
  const parsed = parseCityMunicipalityLine(rate.cityMunicipality ?? '');
  const municipality = normalizePlaceKey(
    rate.municipalityName?.trim() || parsed.municipality,
  );
  const state = normalizePlaceKey(rate.stateName?.trim() || parsed.state);
  if (scope === 'state') {
    return `${origin}|state:${state || 'unknown'}`;
  }
  return `${origin}|muni:${state}|${municipality || 'unknown'}`;
}

function displayNamesFromRate(rate: DestinationRate): {
  municipality: string;
  state: string;
} {
  const rawCity = (rate.cityMunicipality ?? '').trim();
  const parsed = parseCityMunicipalityLine(rawCity);
  const stateFromFields = (rate.stateName?.trim() || parsed.state).trim();
  // Scope estado: cityMunicipality suele ser solo el estado (sin coma).
  const state =
    stateFromFields ||
    (!parsed.state ? rawCity : '');
  const municipality = (
    rate.municipalityName?.trim() ||
    (parsed.state ? parsed.municipality : '')
  ).trim();
  return { municipality, state };
}

function isSencilloOrDobleArticuladoConfig(cfg?: {
  code?: string;
  name?: string;
}): boolean {
  const code = (cfg?.code ?? '').trim().toLowerCase();
  const name = (cfg?.name ?? '').trim().toLowerCase();
  if (code === 'sencillo' || name === 'sencillo') {
    return true;
  }
  if (
    code === 'full' ||
    code === 'doble-articulado' ||
    code === 'doble_articulado' ||
    name.includes('doble articulado') ||
    name === 'full'
  ) {
    return true;
  }
  return false;
}

/** Mayor cobro cliente entre sencillo / doble articulado. */
function maxSencilloOrDobleCharge(rate: DestinationRate): number {
  let best = -1;
  for (const price of rate.prices ?? []) {
    if (!isSencilloOrDobleArticuladoConfig(price.operationConfiguration)) {
      continue;
    }
    const amount = Number(price.clientCharge ?? 0);
    if (Number.isFinite(amount) && amount > best) {
      best = amount;
    }
  }
  return best;
}

@Injectable()
export class DestinationRateScopeMigrationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(DestinationRate)
    private readonly ratesRepo: Repository<DestinationRate>,
    @InjectRepository(DestinationRatePrice)
    private readonly pricesRepo: Repository<DestinationRatePrice>,
    @InjectRepository(ClientDelivery)
    private readonly deliveriesRepo: Repository<ClientDelivery>,
  ) {}

  /**
   * Aplica el cambio de política sobre tarifas existentes.
   * - Grano más grueso: colapsa y toma el precio máximo por tipo de maniobra.
   * - Grano más fino: marca routeKeyIncomplete (hay que completar a mano).
   * - Mismo grano (p. ej. ya en estado): repara duplicados desactivando extras.
   */
  async migrateCompanyScope(
    companyId: number,
    fromRaw: string,
    toRaw: string,
  ): Promise<{ collapsedGroups: number; markedIncomplete: number }> {
    const from = normalizeDestinationRateScope(fromRaw);
    const to = normalizeDestinationRateScope(toRaw);
    if (from === to) {
      if (to === 'state' || to === 'municipality') {
        const deactivated = await this.deactivateDuplicateRatesForScope(
          companyId,
          to,
        );
        return { collapsedGroups: deactivated, markedIncomplete: 0 };
      }
      return { collapsedGroups: 0, markedIncomplete: 0 };
    }

    if (isDestinationRateScopeCoarsening(from, to)) {
      const collapsedGroups = await this.collapseToCoarserScope(companyId, to);
      return { collapsedGroups, markedIncomplete: 0 };
    }

    const markedIncomplete = await this.markIncompleteForFinerScope(
      companyId,
      to,
    );
    return { collapsedGroups: 0, markedIncomplete };
  }

  /**
   * Desactiva tarifas activas duplicadas por destino (mismo origen + estado
   * o municipio). Fusiona el cobro máximo por tipo de maniobra en la survivor
   * (sencillo, doble articulado, volteo, etc. conviven).
   */
  async deactivateDuplicateRatesForScope(
    companyId: number,
    scope: DestinationRateScope,
  ): Promise<number> {
    if (scope !== 'state' && scope !== 'municipality') {
      return 0;
    }
    const rates = await this.ratesRepo.find({
      where: { companyId, active: true },
      relations: ['prices', 'prices.operationConfiguration'],
      order: { id: 'ASC' },
    });
    if (rates.length <= 1) {
      return 0;
    }

    const groups = new Map<string, DestinationRate[]>();
    for (const rate of rates) {
      const names = displayNamesFromRate(rate);
      if (scope === 'state' && !names.state.trim()) {
        continue;
      }
      if (
        scope === 'municipality' &&
        (!names.municipality.trim() || !names.state.trim())
      ) {
        continue;
      }
      const key = groupKeyForScope(rate, scope);
      const list = groups.get(key) ?? [];
      list.push(rate);
      groups.set(key, list);
    }

    let deactivated = 0;
    await this.dataSource.transaction(async (manager) => {
      const rateRepo = manager.getRepository(DestinationRate);
      const priceRepo = manager.getRepository(DestinationRatePrice);

      for (const [, members] of groups) {
        if (members.length <= 1) {
          continue;
        }
        const survivor = this.pickSurvivorBySencilloOrDoble(members);
        const names = displayNamesFromRate(survivor);
        for (const m of members) {
          const n = displayNamesFromRate(m);
          if (!names.municipality && n.municipality) {
            names.municipality = n.municipality;
          }
          if (!names.state && n.state) {
            names.state = n.state;
          }
        }

        survivor.destinationScope = scope;
        survivor.routeKeyIncomplete = false;
        survivor.stateName = names.state;
        survivor.municipalityName = scope === 'state' ? '' : names.municipality;
        survivor.cityMunicipality =
          scope === 'state'
            ? names.state
            : [names.municipality, names.state].filter(Boolean).join(', ');
        survivor.postalCode = '';
        survivor.locality = '';
        survivor.active = true;

        const priceByConfig = new Map<number, DestinationRatePrice>();
        for (const member of members) {
          for (const price of member.prices ?? []) {
            const cfgId = price.operationConfigurationId;
            const existing = priceByConfig.get(cfgId);
            if (!existing) {
              priceByConfig.set(cfgId, {
                ...price,
                destinationRateId: survivor.id,
              } as DestinationRatePrice);
              continue;
            }
            existing.clientCharge = maxMoney(
              existing.clientCharge,
              price.clientCharge,
            );
            existing.operatorPaymentEstimate = maxMoney(
              existing.operatorPaymentEstimate,
              price.operatorPaymentEstimate,
            );
            existing.estimatedTollAmount = maxMoney(
              existing.estimatedTollAmount,
              price.estimatedTollAmount,
            );
            existing.perDiemAmount = maxMoney(
              existing.perDiemAmount,
              price.perDiemAmount,
            );
            if (
              (price.axleCount ?? 0) > 0 &&
              (existing.axleCount == null ||
                (price.axleCount ?? 0) > (existing.axleCount ?? 0))
            ) {
              existing.axleCount = price.axleCount;
            }
          }
        }

        await rateRepo.save(survivor);
        await priceRepo.delete({ destinationRateId: survivor.id });
        for (const merged of priceByConfig.values()) {
          await priceRepo.save(
            priceRepo.create({
              destinationRateId: survivor.id,
              operationConfigurationId: merged.operationConfigurationId,
              clientCharge: merged.clientCharge,
              operatorPaymentEstimate: merged.operatorPaymentEstimate,
              estimatedTollAmount: merged.estimatedTollAmount,
              perDiemAmount: merged.perDiemAmount,
              axleCount: merged.axleCount,
              notes: merged.notes,
            }),
          );
        }

        for (const member of members) {
          if (member.id === survivor.id) {
            continue;
          }
          member.active = false;
          await rateRepo.save(member);
          deactivated += 1;
        }
      }
    });
    return deactivated;
  }

  private async markIncompleteForFinerScope(
    companyId: number,
    to: DestinationRateScope,
  ): Promise<number> {
    const rates = await this.ratesRepo.find({ where: { companyId } });
    if (rates.length === 0) {
      return 0;
    }
    for (const rate of rates) {
      rate.destinationScope = to;
      rate.routeKeyIncomplete = true;
      if (to === 'postal_code') {
        /* Conserva municipio/estado en cityMunicipality; CP/localidad a completar. */
        rate.postalCode = rate.postalCode?.trim() || '';
        if (rate.postalCode.length !== 5) {
          rate.postalCode = '';
        }
        rate.locality = '';
      } else if (to === 'municipality') {
        rate.postalCode = '';
        rate.locality = '';
        const names = displayNamesFromRate(rate);
        rate.municipalityName = names.municipality;
        rate.stateName = names.state;
        if (!rate.municipalityName) {
          /* Sin municipio no se puede cotizar aún. */
          rate.routeKeyIncomplete = true;
        }
      }
    }
    await this.ratesRepo.save(rates);
    return rates.length;
  }

  private async collapseToCoarserScope(
    companyId: number,
    to: DestinationRateScope,
  ): Promise<number> {
    const rates = await this.ratesRepo.find({
      where: { companyId },
      relations: ['prices'],
      order: { id: 'ASC' },
    });
    if (rates.length === 0) {
      return 0;
    }

    const groups = new Map<string, DestinationRate[]>();
    const unresolved: DestinationRate[] = [];
    for (const rate of rates) {
      const names = displayNamesFromRate(rate);
      if (to === 'state' && !names.state.trim()) {
        unresolved.push(rate);
        continue;
      }
      if (to === 'municipality' && (!names.municipality.trim() || !names.state.trim())) {
        unresolved.push(rate);
        continue;
      }
      const key = groupKeyForScope(rate, to);
      const list = groups.get(key) ?? [];
      list.push(rate);
      groups.set(key, list);
    }

    let collapsedGroups = 0;
    await this.dataSource.transaction(async (manager) => {
      const rateRepo = manager.getRepository(DestinationRate);
      const priceRepo = manager.getRepository(DestinationRatePrice);
      const deliveryRepo = manager.getRepository(ClientDelivery);

      for (const rate of unresolved) {
        rate.destinationScope = to;
        rate.routeKeyIncomplete = true;
        rate.postalCode = '';
        rate.locality = '';
        await rateRepo.save(rate);
      }

      for (const [, members] of groups) {
        if (members.length === 0) {
          continue;
        }
        collapsedGroups += 1;
        const survivor =
          to === 'state'
            ? this.pickSurvivorBySencilloOrDoble(members)
            : this.pickSurvivor(members);
        const loserIds = members
          .filter((r) => r.id !== survivor.id)
          .map((r) => r.id);

        const names = displayNamesFromRate(survivor);
        for (const m of members) {
          const n = displayNamesFromRate(m);
          if (!names.municipality && n.municipality) {
            names.municipality = n.municipality;
          }
          if (!names.state && n.state) {
            names.state = n.state;
          }
        }

        survivor.destinationScope = to;
        survivor.routeKeyIncomplete = false;
        survivor.municipalityName =
          to === 'state' ? '' : names.municipality;
        survivor.stateName = names.state;
        survivor.cityMunicipality =
          to === 'state'
            ? names.state
            : [names.municipality, names.state].filter(Boolean).join(', ');
        survivor.postalCode = '';
        survivor.locality = '';

        const priceByConfig = new Map<number, DestinationRatePrice>();
        for (const member of members) {
          for (const price of member.prices ?? []) {
            const cfgId = price.operationConfigurationId;
            const existing = priceByConfig.get(cfgId);
            if (!existing) {
              priceByConfig.set(cfgId, {
                ...price,
                destinationRateId: survivor.id,
              } as DestinationRatePrice);
              continue;
            }
            existing.clientCharge = maxMoney(
              existing.clientCharge,
              price.clientCharge,
            );
            existing.operatorPaymentEstimate = maxMoney(
              existing.operatorPaymentEstimate,
              price.operatorPaymentEstimate,
            );
            existing.estimatedTollAmount = maxMoney(
              existing.estimatedTollAmount,
              price.estimatedTollAmount,
            );
            existing.perDiemAmount = maxMoney(
              existing.perDiemAmount,
              price.perDiemAmount,
            );
            if (
              (price.axleCount ?? 0) > 0 &&
              (existing.axleCount == null ||
                (price.axleCount ?? 0) > (existing.axleCount ?? 0))
            ) {
              existing.axleCount = price.axleCount;
            }
          }
        }

        await rateRepo.save(survivor);

        /* Reemplaza precios del survivor por el merge max. */
        await priceRepo.delete({ destinationRateId: survivor.id });
        for (const merged of priceByConfig.values()) {
          await priceRepo.save(
            priceRepo.create({
              destinationRateId: survivor.id,
              operationConfigurationId: merged.operationConfigurationId,
              clientCharge: merged.clientCharge,
              operatorPaymentEstimate: merged.operatorPaymentEstimate,
              estimatedTollAmount: merged.estimatedTollAmount,
              perDiemAmount: merged.perDiemAmount,
              axleCount: merged.axleCount,
              notes: merged.notes,
            }),
          );
        }

        if (loserIds.length > 0) {
          await deliveryRepo
            .createQueryBuilder()
            .update(ClientDelivery)
            .set({ destinationRateId: survivor.id })
            .where('destination_rate_id IN (:...ids)', { ids: loserIds })
            .execute();

          await manager.query(
            `
              UPDATE terminalops.trips
              SET destination_rate_id = $1
              WHERE destination_rate_id = ANY($2::int[])
            `,
            [survivor.id, loserIds],
          );

          await rateRepo.delete({ id: In(loserIds) });
        }
      }
    });

    return collapsedGroups;
  }

  /** Prefiere la tarifa con coords y más precios; desempate por id menor. */
  private pickSurvivor(members: DestinationRate[]): DestinationRate {
    return [...members].sort((a, b) => {
      const aCoords =
        a.destinationLatitude != null && a.destinationLongitude != null ? 1 : 0;
      const bCoords =
        b.destinationLatitude != null && b.destinationLongitude != null ? 1 : 0;
      if (bCoords !== aCoords) {
        return bCoords - aCoords;
      }
      const aPrices = a.prices?.length ?? 0;
      const bPrices = b.prices?.length ?? 0;
      if (bPrices !== aPrices) {
        return bPrices - aPrices;
      }
      return a.id - b.id;
    })[0]!;
  }

  /** Prefiere mayor cobro sencillo/doble articulado; luego coords / id. */
  private pickSurvivorBySencilloOrDoble(
    members: DestinationRate[],
  ): DestinationRate {
    return [...members].sort((a, b) => {
      const scoreDiff = maxSencilloOrDobleCharge(b) - maxSencilloOrDobleCharge(a);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      const aCoords =
        a.destinationLatitude != null && a.destinationLongitude != null ? 1 : 0;
      const bCoords =
        b.destinationLatitude != null && b.destinationLongitude != null ? 1 : 0;
      if (bCoords !== aCoords) {
        return bCoords - aCoords;
      }
      return a.id - b.id;
    })[0]!;
  }
}
