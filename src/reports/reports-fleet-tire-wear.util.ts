/** Misma base que `trip-operational-provision` en la app. */
const AVG_TIRE_COST_MXN = 8_500;
const TIRE_LIFE_KM = 100_000;
const BASELINE_LOAD_TONS = 22;
const DEFAULT_TIRE_POSITIONS = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseApproxWeightTons(raw: string | number | null | undefined): number {
  if (raw == null || raw === '') {
    return BASELINE_LOAD_TONS;
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.').trim());
  if (!Number.isFinite(n) || n <= 0) {
    return BASELINE_LOAD_TONS;
  }
  return n;
}

function tireLoadFactor(weightTons: number): number {
  return 1 + clamp((weightTons - BASELINE_LOAD_TONS) * 0.012, 0, 0.35);
}

export function tireCpkMxn(positions: number, weightTons: number): number {
  const baseCpk = (positions * AVG_TIRE_COST_MXN) / TIRE_LIFE_KM;
  return baseCpk * tireLoadFactor(weightTons);
}

export function estimateTireWearMxn(
  operationalKm: number,
  weightTons: number,
  tirePositions = DEFAULT_TIRE_POSITIONS,
): { tireWearMxn: number; tireCpkMxn: number; tireLifeUsedPercent: number } {
  const km = Math.max(0, operationalKm);
  const weight = parseApproxWeightTons(weightTons);
  const cpk = tireCpkMxn(tirePositions, weight);
  const tireWearMxn = Math.round(km * cpk);
  const tireLifeUsedPercent =
    TIRE_LIFE_KM > 0
      ? Math.round(((km / TIRE_LIFE_KM) * tireLoadFactor(weight)) * 1000) / 10
      : 0;
  return {
    tireWearMxn,
    tireCpkMxn: Math.round(cpk * 100) / 100,
    tireLifeUsedPercent,
  };
}
