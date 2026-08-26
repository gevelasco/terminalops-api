/** Perfiles heurísticos. Precio diesel: `FuelPriceService`. */

/**
 * Rendimiento de referencia (km/L), no litros por km.
 *
 * Tractocamión 2021 afinado, operador bueno, foránea con tramos lentos
 * (“vuelta de rueda”): ~2.8 km/L. El llenado 500 L + 100 L − ~35 L ≈ 565 L
 * en 720 km ida es un aproximado de campo (~2.55 km/L); usamos 2.8 como
 * dijo el operador. Cada unidad consume distinto: esto es una heurística.
 */
export const FIELD_CALIBRATION_KM_PER_LITER = 2.8;

/** Relación entre perfiles respecto a sencillo vacío (antes 3.2 / 2.8 / 2.2 / 1.8). */
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
