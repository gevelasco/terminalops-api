import { Injectable } from '@nestjs/common';

const PHOTON_SEARCH = 'https://photon.komoot.io/api/';
const PHOTON_REVERSE = 'https://photon.komoot.io/reverse';
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const PHOTON_TIMEOUT_MS = 3_500;
const NOMINATIM_TIMEOUT_MS = 8_000;
const USER_AGENT = 'TerminalOps/1.0 (geo-photon-proxy)';

type PhotonFeatureCollection = {
  type: 'FeatureCollection';
  features: unknown[];
};

@Injectable()
export class PhotonProxyService {
  async search(params: {
    q: string;
    limit?: number;
    lang?: string;
    bbox?: string;
  }): Promise<unknown> {
    const q = params.q?.trim() ?? '';
    if (q.length < 2) {
      return { type: 'FeatureCollection', features: [] };
    }
    const url = new URL(PHOTON_SEARCH);
    url.searchParams.set('q', q);
    url.searchParams.set('limit', String(params.limit ?? 15));
    url.searchParams.set('lang', params.lang ?? 'default');
    const bbox = params.bbox?.trim();
    if (bbox) {
      url.searchParams.set('bbox', bbox);
    }
    const photon = await this.tryFetchPhotonJson(url);
    if (photon && this.featureCount(photon) > 0) {
      return photon;
    }
    const nominatim = await this.searchNominatimAsPhoton(
      q,
      Math.min(params.limit ?? 15, 20),
    );
    return nominatim;
  }

  async reverse(params: {
    lat: number;
    lon: number;
    lang?: string;
  }): Promise<unknown> {
    const { lat, lon } = params;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { type: 'FeatureCollection', features: [] };
    }
    const url = new URL(PHOTON_REVERSE);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('lang', params.lang ?? 'default');
    const photon = await this.tryFetchPhotonJson(url);
    if (photon && this.featureCount(photon) > 0) {
      return photon;
    }
    return this.reverseNominatimAsPhoton(params.lat, params.lon);
  }

  private featureCount(body: unknown): number {
    if (!body || typeof body !== 'object') {
      return 0;
    }
    const features = (body as PhotonFeatureCollection).features;
    return Array.isArray(features) ? features.length : 0;
  }

  private async tryFetchPhotonJson(url: URL): Promise<unknown | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PHOTON_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
      });
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as unknown;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async searchNominatimAsPhoton(
    q: string,
    limit: number,
  ): Promise<PhotonFeatureCollection> {
    const url = new URL(NOMINATIM_SEARCH);
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('countrycodes', 'mx');
    url.searchParams.set('limit', String(limit));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
      });
      if (!res.ok) {
        return { type: 'FeatureCollection', features: [] };
      }
      const hits = (await res.json()) as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
        address?: Record<string, string | undefined>;
      }>;
      return {
        type: 'FeatureCollection',
        features: hits.map((hit) => this.nominatimHitToPhotonFeature(hit)),
      };
    } catch {
      return { type: 'FeatureCollection', features: [] };
    } finally {
      clearTimeout(timer);
    }
  }

  private async reverseNominatimAsPhoton(
    lat: number,
    lon: number,
  ): Promise<PhotonFeatureCollection> {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
      });
      if (!res.ok) {
        return { type: 'FeatureCollection', features: [] };
      }
      const hit = (await res.json()) as {
        lat?: string;
        lon?: string;
        display_name?: string;
        address?: Record<string, string | undefined>;
      };
      return {
        type: 'FeatureCollection',
        features: [this.nominatimHitToPhotonFeature(hit)],
      };
    } catch {
      return { type: 'FeatureCollection', features: [] };
    } finally {
      clearTimeout(timer);
    }
  }

  private nominatimHitToPhotonFeature(hit: {
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: Record<string, string | undefined>;
  }): unknown {
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    const address = hit.address ?? {};
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat],
      },
      properties: {
        name: hit.display_name ?? '',
        city: address.city ?? address.town ?? address.village,
        county: address.county ?? address.municipality,
        state: address.state,
        country: address.country ?? 'México',
        countrycode: 'MX',
      },
    };
  }
}