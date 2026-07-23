import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface MxPostalSettlementDto {
  postalCode: string;
  settlement: string;
  settlementType: string;
  municipality: string;
  state: string;
  city: string;
  settlementConsId: string;
}

interface SepomexCpPayload {
  total_records?: number;
  postcodes?: SepomexRawRow[];
}

interface SepomexCpJson {
  data?: SepomexCpPayload;
  error?: unknown;
}

interface SepomexRawRow {
  d_codigo: string;
  d_asenta: string;
  d_tipo_asenta: string;
  d_mnpio: string;
  d_estado: string;
  d_ciudad: string;
  id_asenta_cpcons: string;
}

interface ZippopotamPlace {
  'place name'?: string;
  state?: string;
  'state abbreviation'?: string;
  latitude?: string;
  longitude?: string;
}

interface ZippopotamJson {
  'post code'?: string;
  places?: ZippopotamPlace[];
}

interface NominatimAddress {
  county?: string;
  city?: string;
  town?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
}

interface NominatimSearchHit {
  address?: NominatimAddress;
}

@Injectable()
export class SepomexLookupService {
  private static readonly sepomexApiBase =
    'https://sepomex.nitrostudio.com.mx/api/20241116/cp';
  private static readonly zippopotamApiBase = 'https://api.zippopotam.us/mx';
  private static readonly nominatimSearchUrl =
    'https://nominatim.openstreetmap.org/search';

  /** Cache CP → municipio (Nominatim), para no repetir lookups. */
  private readonly municipalityByCp = new Map<string, string>();

  async lookupByPostalCode(postalCode: string): Promise<MxPostalSettlementDto[]> {
    const cp = postalCode.replace(/\D/g, '').slice(0, 5);
    if (cp.length !== 5) {
      throw new BadRequestException('El código postal debe tener 5 dígitos.');
    }

    const primary = await this.lookupSepomex(cp);
    if (primary.status === 'ok') {
      return primary.rows;
    }

    const fallback = await this.lookupZippopotam(cp);
    if (fallback.status === 'ok') {
      return this.enrichMunicipalityFromNominatim(cp, fallback.rows);
    }
    if (fallback.status === 'not_found') {
      throw new NotFoundException('Código postal no encontrado.');
    }

    throw new ServiceUnavailableException(
      'No se pudo consultar el catálogo postal. Intenta de nuevo en unos momentos.',
    );
  }

  private async lookupSepomex(
    cp: string,
  ): Promise<
    | { status: 'ok'; rows: MxPostalSettlementDto[] }
    | { status: 'unavailable' }
  > {
    const url = `${SepomexLookupService.sepomexApiBase}/${cp}.json`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
    } catch {
      return { status: 'unavailable' };
    }

    if (!res.ok) {
      return { status: 'unavailable' };
    }

    try {
      const body = (await res.json()) as SepomexCpJson;
      const rows = this.mapSepomexRows(body?.data?.postcodes ?? [], cp);
      if (rows.length === 0) {
        return { status: 'unavailable' };
      }
      return { status: 'ok', rows };
    } catch {
      return { status: 'unavailable' };
    }
  }

  private async lookupZippopotam(
    cp: string,
  ): Promise<
    | { status: 'ok'; rows: MxPostalSettlementDto[] }
    | { status: 'not_found' }
    | { status: 'unavailable' }
  > {
    const url = `${SepomexLookupService.zippopotamApiBase}/${cp}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
    } catch {
      return { status: 'unavailable' };
    }

    if (res.status === 404) {
      return { status: 'not_found' };
    }
    if (!res.ok) {
      return { status: 'unavailable' };
    }

    try {
      const body = (await res.json()) as ZippopotamJson;
      const rows = this.mapZippopotamRows(body, cp);
      if (rows.length === 0) {
        return { status: 'not_found' };
      }
      return { status: 'ok', rows };
    } catch {
      return { status: 'unavailable' };
    }
  }

  private mapSepomexRows(
    raw: SepomexRawRow[],
    cpFallback: string,
  ): MxPostalSettlementDto[] {
    const mapped: MxPostalSettlementDto[] = raw.map((r) => ({
      postalCode: (r.d_codigo ?? cpFallback).trim(),
      settlement: (r.d_asenta ?? '').trim(),
      settlementType: (r.d_tipo_asenta ?? '').trim(),
      municipality: (r.d_mnpio ?? '').trim(),
      state: (r.d_estado ?? '').trim(),
      city: (r.d_ciudad ?? '').trim(),
      settlementConsId: String(r.id_asenta_cpcons ?? '').trim(),
    }));
    return this.dedupeAndSort(mapped);
  }

  private mapZippopotamRows(
    body: ZippopotamJson,
    cpFallback: string,
  ): MxPostalSettlementDto[] {
    const cp = (body['post code'] ?? cpFallback).trim() || cpFallback;
    const places = body.places ?? [];
    const mapped: MxPostalSettlementDto[] = places.map((place, index) => {
      const settlement = (place['place name'] ?? '').trim();
      const state = (place.state ?? '').trim();
      return {
        postalCode: cp,
        settlement,
        settlementType: '',
        municipality: '',
        state,
        city: '',
        settlementConsId: `${cp}-${index + 1}-${settlement}`.slice(0, 80),
      };
    });
    return this.dedupeAndSort(mapped.filter((row) => row.settlement.length > 0));
  }

  /**
   * Zippopotam no trae municipio; Nominatim por CP suele devolver `county`
   * (p. ej. Zapopan / Guadalajara).
   */
  private async enrichMunicipalityFromNominatim(
    cp: string,
    rows: MxPostalSettlementDto[],
  ): Promise<MxPostalSettlementDto[]> {
    if (rows.length === 0) {
      return rows;
    }
    if (rows.every((r) => r.municipality.trim() || r.city.trim())) {
      return rows;
    }

    const municipality = await this.lookupMunicipalityByPostalCode(cp);
    if (!municipality) {
      return rows;
    }

    return rows.map((row) => ({
      ...row,
      municipality: row.municipality.trim() || municipality,
      city: row.city.trim() || municipality,
    }));
  }

  private async lookupMunicipalityByPostalCode(cp: string): Promise<string> {
    const cached = this.municipalityByCp.get(cp);
    if (cached != null) {
      return cached;
    }

    const url = new URL(SepomexLookupService.nominatimSearchUrl);
    url.searchParams.set('postalcode', cp);
    url.searchParams.set('countrycodes', 'mx');
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '1');

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TerminalOps/1.0 (geo-postal-enrichment)',
        },
      });
    } catch {
      this.municipalityByCp.set(cp, '');
      return '';
    }

    if (!res.ok) {
      this.municipalityByCp.set(cp, '');
      return '';
    }

    try {
      const hits = (await res.json()) as NominatimSearchHit[];
      const address = hits[0]?.address;
      const municipality = (
        address?.county ||
        address?.city ||
        address?.town ||
        address?.municipality ||
        ''
      ).trim();
      this.municipalityByCp.set(cp, municipality);
      return municipality;
    } catch {
      this.municipalityByCp.set(cp, '');
      return '';
    }
  }

  private dedupeAndSort(
    mapped: MxPostalSettlementDto[],
  ): MxPostalSettlementDto[] {
    const dedup = new Map<string, MxPostalSettlementDto>();
    for (const m of mapped) {
      const k = `${m.settlementConsId}|${m.settlement}|${m.municipality}`;
      if (!dedup.has(k)) {
        dedup.set(k, m);
      }
    }
    return [...dedup.values()].sort((a, b) =>
      a.settlement.localeCompare(b.settlement, 'es-MX', { sensitivity: 'base' }),
    );
  }
}
