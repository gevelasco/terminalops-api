/** Granularidad comercial de tarifas por destino (política de empresa). */
export const DESTINATION_RATE_SCOPES = [
  'postal_code',
  'municipality',
  'state',
] as const;

export type DestinationRateScope = (typeof DESTINATION_RATE_SCOPES)[number];

export const DESTINATION_RATE_SCOPE_DEFAULT: DestinationRateScope = 'postal_code';

export function destinationRateScopeRank(scope: DestinationRateScope): number {
  switch (scope) {
    case 'postal_code':
      return 0;
    case 'municipality':
      return 1;
    case 'state':
      return 2;
  }
}

export function isDestinationRateScope(value: unknown): value is DestinationRateScope {
  return (
    value === 'postal_code' || value === 'municipality' || value === 'state'
  );
}

export function normalizeDestinationRateScope(
  value: unknown,
): DestinationRateScope {
  return isDestinationRateScope(value) ? value : DESTINATION_RATE_SCOPE_DEFAULT;
}

/** true = colapsar (más grueso). false = marcar incompletas (más fino). */
export function isDestinationRateScopeCoarsening(
  from: DestinationRateScope,
  to: DestinationRateScope,
): boolean {
  return destinationRateScopeRank(to) > destinationRateScopeRank(from);
}

export function normalizePlaceKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Línea "municipio, estado" → partes. */
export function parseCityMunicipalityLine(cityMunicipality: string): {
  municipality: string;
  state: string;
} {
  const raw = cityMunicipality.trim();
  const comma = raw.lastIndexOf(',');
  if (comma > 0) {
    return {
      municipality: raw.slice(0, comma).trim(),
      state: raw.slice(comma + 1).trim(),
    };
  }
  return { municipality: raw, state: '' };
}
