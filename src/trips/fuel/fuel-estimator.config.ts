/** Perfiles heurísticos. Precio diesel: `FuelPriceService`. */

/** Rendimiento de referencia (km/L) para perfiles heurísticos sin rendimiento de unidad. */
export const FIELD_CALIBRATION_KM_PER_LITER = 2.8;

/** Relación de perfiles respecto a sencillo vacío. */
const PROFILE_RATIO_TO_SENCILLO_VACIO = {
  sencillo_vacio: 1,
  sencillo_loaded: 2.8 / 3.2,
  full_vacio: 2.2 / 3.2,
  full_loaded: 1.8 / 3.2,
} as const;

/** km/L base por configuración + carga. */
export const BASE_KM_PER_LITER: Record<string, number> = {
  sencillo_vacio:
    FIELD_CALIBRATION_KM_PER_LITER * PROFILE_RATIO_TO_SENCILLO_VACIO.sencillo_vacio,
  sencillo_loaded:
    FIELD_CALIBRATION_KM_PER_LITER * PROFILE_RATIO_TO_SENCILLO_VACIO.sencillo_loaded,
  full_vacio:
    FIELD_CALIBRATION_KM_PER_LITER * PROFILE_RATIO_TO_SENCILLO_VACIO.full_vacio,
  full_loaded:
    FIELD_CALIBRATION_KM_PER_LITER * PROFILE_RATIO_TO_SENCILLO_VACIO.full_loaded,
};

/** Umbral km para maniobra local (alineado con frontend). */
export const LOCAL_ROUTE_MAX_KM = 25;

export const ROUTE_FACTOR_LOCAL = 0.9;
export const ROUTE_FACTOR_FORANEA = 1.0;

/** Tara de contenedor vacío (t). El peso de maniobra se trata como mercancía. */
export const EMPTY_CONTAINER_TONS = 3.5;

/**
 * Derating por tonelada: km/L = base / (1 + coeficiente × t).
 * Configurable; calibrar con km OSRM reales de operación.
 */
export const WEIGHT_LOAD_COEFFICIENT = 0.025;

export type WeightBucket = {
  minTons: number;
  maxTons: number | null;
  factor: number;
};

/** Factor multiplicador sobre km/L (menor = más consumo). Solo path heurístico sin rendimiento de unidad. */
export const WEIGHT_BUCKETS: WeightBucket[] = [
  { minTons: 0, maxTons: 5, factor: 1.0 },
  { minTons: 5, maxTons: 15, factor: 0.92 },
  { minTons: 15, maxTons: 25, factor: 0.85 },
  { minTons: 25, maxTons: null, factor: 0.75 },
];
