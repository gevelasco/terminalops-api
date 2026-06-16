import type { FleetBrandType } from 'src/fleet/entities/fleet-brand.entity';

type FleetMetaWithCatalog = {
  trailerBrandName?: string;
  trailerVersion?: string;
} | null | undefined;

export function resolveFleetBrandNameFromPayload(
  fleetMeta: FleetMetaWithCatalog,
  trailerBrandAbbr?: string,
): string | null {
  const fromMeta = fleetMeta?.trailerBrandName?.trim();
  if (fromMeta) {
    return fromMeta;
  }
  const fromAbbr = trailerBrandAbbr?.trim();
  return fromAbbr || null;
}

export function resolveFleetVersionNameFromPayload(
  fleetMeta: FleetMetaWithCatalog,
): string | null {
  const version = fleetMeta?.trailerVersion?.trim();
  return version || null;
}

export const FLEET_BRAND_TYPE_UNIT: FleetBrandType = 'UNIT';
export const FLEET_BRAND_TYPE_EQUIPMENT: FleetBrandType = 'EQUIPMENT';
