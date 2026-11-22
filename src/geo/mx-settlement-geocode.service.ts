import { Injectable } from '@nestjs/common';

const ZIPPOPOTAM_MX = 'https://api.zippopotam.us/mx';
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const FETCH_TIMEOUT_MS = 6_000;
const USER_AGENT = 'TerminalOps/1.0 (mx-settlement-geocode)';

export type MxSettlementGeocodeInput = {
  postalCode: string;
  settlement?: string;
  municipality?: string;
  state?: string;
};

export type MxSettlementGeocodeResult = {
  lat: number;
  lon: number;
  source: 'zippopotam' | 'nominatim';
};

@Injectable()
export class MxSettlementGeocodeService {
  async resolve(
    input: MxSettlementGeocodeInput,
  ): Promise<MxSettlementGeocodeResult | null> {
    const cp = input.postalCode.replace(/\D/g, '').slice(0, 5);
    if (cp.length !== 5) {
      return null;
    }
    const settlement = (input.settlement ?? '').trim();
    const municipality = (input.municipality ?? '').trim();
    const state = (input.state ?? '').trim();

    const fromZip = await this.coordsFromZippopotam(cp, settlement);
    if (fromZip) {
      return fromZip;
    }

    const q = [settlement, municipality, state, cp, 'México']
      .filter(Boolean)
      .join(', ');
    if (q.length < 5) {
      return null;
    }
    return this.coordsFromNominatim(q);
  }

  private async coordsFromZippopotam(
    cp: string,
    settlement: string,
  ): Promise<MxSettlementGeocodeResult | null> {
    const url = `${ZIPPOPOTAM_MX}/${cp}`;
    let res: Response;
    try {
      res = await this.fetchJson(url);
    } catch {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    let body: {
      places?: Array<{
        'place name'?: string;
        latitude?: string;
        longitude?: string;
      }>;
    };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      return null;
    }
    const places = body.places ?? [];
    if (places.length === 0) {
      return null;
    }
    const normSettlement = this.norm(settlement);
    let fallback: MxSettlementGeocodeResult | null = null;
    for (const place of places) {
      const lat = Number(place.latitude);
      const lon = Number(place.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        continue;
      }
      const candidate: MxSettlementGeocodeResult = {
        lat,
        lon,
        source: 'zippopotam',
      };
      if (!fallback) {
        fallback = candidate;
      }
      const name = (place['place name'] ?? '').trim();
      if (!normSettlement || !name) {
        continue;
      }
      const normName = this.norm(name);
      if (normName === normSettlement || normName.includes(normSettlement)) {
        return candidate;
      }
    }
    return fallback;
  }

  private async coordsFromNominatim(
    query: string,
  ): Promise<MxSettlementGeocodeResult | null> {
    const url = new URL(NOMINATIM_SEARCH);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '0');
    url.searchParams.set('countrycodes', 'mx');
    url.searchParams.set('limit', '1');
    let res: Response;
    try {
      res = await this.fetchJson(url, { Accept: 'application/json' });
    } catch {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    let hits: Array<{ lat?: string; lon?: string }>;
    try {
      hits = (await res.json()) as typeof hits;
    } catch {
      return null;
    }
    const first = hits[0];
    if (!first) {
      return null;
    }
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    return { lat, lon, source: 'nominatim' };
  }

  private norm(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async fetchJson(
    url: string | URL,
    headers?: Record<string, string>,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
          ...headers,
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }
}