import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

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

@Injectable()
export class SepomexLookupService {
  private static readonly apiBase =
    'https://sepomex.nitrostudio.com.mx/api/20241116/cp';

  async lookupByPostalCode(postalCode: string): Promise<MxPostalSettlementDto[]> {
    const cp = postalCode.replace(/\D/g, '').slice(0, 5);
    if (cp.length !== 5) {
      throw new BadRequestException('El código postal debe tener 5 dígitos.');
    }

    const url = `${SepomexLookupService.apiBase}/${cp}.json`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new NotFoundException('No se pudo consultar el catálogo postal.');
    }

    if (!res.ok) {
      throw new NotFoundException('Código postal no encontrado.');
    }

    const body = (await res.json()) as SepomexCpJson;
    const rows = this.mapRows(body?.data?.postcodes ?? [], cp);
    if (rows.length === 0) {
      throw new NotFoundException('Código postal no encontrado.');
    }
    return rows;
  }

  private mapRows(raw: SepomexRawRow[], cpFallback: string): MxPostalSettlementDto[] {
    const mapped: MxPostalSettlementDto[] = raw.map((r) => ({
      postalCode: (r.d_codigo ?? cpFallback).trim(),
      settlement: (r.d_asenta ?? '').trim(),
      settlementType: (r.d_tipo_asenta ?? '').trim(),
      municipality: (r.d_mnpio ?? '').trim(),
      state: (r.d_estado ?? '').trim(),
      city: (r.d_ciudad ?? '').trim(),
      settlementConsId: String(r.id_asenta_cpcons ?? '').trim(),
    }));
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
