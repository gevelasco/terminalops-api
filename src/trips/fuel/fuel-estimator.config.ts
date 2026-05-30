/** Perfiles heurísticos MVP. Precio diesel: `FuelPriceService`. */

/** km/L base por configuración + carga. */
export const BASE_KM_PER_LITER: Record<string, number> = {
  sencillo_vacio: 3.2,
  sencillo_loaded: 2.8,
  full_vacio: 2.2,
  full_loaded: 1.8,
};

/** Umbral km para maniobra local (alineado con frontend). */
export const LOCAL_ROUTE_MAX_KM = 25;

export const ROUTE_FACTOR_LOCAL = 0.9;
export const ROUTE_FACTOR_FORANEA = 1.0;

export type WeightBucket = {
  minTons: number;
  maxTons: number | null;
  factor: number;
};

/** Factor multiplicador sobre km/L (menor = más consumo). */
export const WEIGHT_BUCKETS: WeightBucket[] = [
  { minTons: 0, maxTons: 5, factor: 1.0 },
  { minTons: 5, maxTons: 15, factor: 0.92 },
  { minTons: 15, maxTons: 25, factor: 0.85 },
  { minTons: 25, maxTons: null, factor: 0.75 },
];
