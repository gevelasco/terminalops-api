import type { FleetBrandType } from 'src/fleet/entities/fleet-brand.entity';

type FleetMetaWithCatalog = {
  trailerBrandName?: string;
  trailerVersion?: string;
} | null | undefined;

/**
 * Solo el nombre completo (`fleetMeta.trailerBrandName`) alimenta el catálogo.
 * `trailerBrandAbbr` es un código operativo derivado; usarlo como fallback
 * contaminaba el catálogo con abreviaciones (ej. "KEN" junto a "Kenworth").
 */
export function resolveFleetBrandNameFromPayload(
  fleetMeta: FleetMetaWithCatalog,
): string | null {
  const fromMeta = fleetMeta?.trailerBrandName?.trim();
  return fromMeta || null;
}

export function resolveFleetVersionNameFromPayload(
  fleetMeta: FleetMetaWithCatalog,
): string | null {
  const version = fleetMeta?.trailerVersion?.trim();
  return version || null;
}

export const FLEET_BRAND_TYPE_UNIT: FleetBrandType = 'UNIT';
export const FLEET_BRAND_TYPE_EQUIPMENT: FleetBrandType = 'EQUIPMENT';
