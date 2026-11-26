import type { DetectedTollPlaza } from './route-toll-detect.util';

/**
 * Radial oriente GDL (México–Zapotlanejo / periférico).
 * No forma parte del acceso Colima → Guadalajara/Zapopan por Acatlán.
 */
const EAST_RING_RE =
  /zapotlanejo|periferico|macrolibramiento|el cortijo|el vado|la joya|arroyo de enmedio|\btonala\b|\btonalá\b/i;

const COLIMA_ENTRY_RE =
  /acatlan|acatlán|guadalajara\s*-\s*colima|colima\s*-\s*guadalajara/i;

function norm(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function labelOf(hit: DetectedTollPlaza): string {
  return `${hit.plaza.name ?? ''} ${hit.plaza.section ?? ''}`;
}

export function isColimaGuadalajaraEntryPlaza(hit: DetectedTollPlaza): boolean {
  return COLIMA_ENTRY_RE.test(norm(labelOf(hit)));
}

export function isGuadalajaraEastRingPlaza(hit: DetectedTollPlaza): boolean {
  return EAST_RING_RE.test(norm(labelOf(hit)));
}

/**
 * Longitudes al oriente de este umbral ≈ Tonalá/Zapotlanejo (sí pagan anillo oriente).
 * Zapopan / GDL poniente quedan al oeste (p. ej. -103.39) y no deben pagar ese radial
 * si ya entraron por Acatlán.
 */
const GDL_EAST_APPROACH_LNG = -103.3;

/**
 * Si la ruta ya entró por Acatlán (Colima–GDL) y luego “pasea” el anillo oriente
 * (Zapotlanejo/periférico), recorta esas casetas cuando el destino no está en
 * el radial oriente (Zapopan / poniente).
 */
export function stripEastRingAfterColimaEntry(
  detected: readonly DetectedTollPlaza[],
  destination: { lat: number; lon: number },
): DetectedTollPlaza[] {
  const entryIdx = detected.findIndex(isColimaGuadalajaraEntryPlaza);
  if (entryIdx < 0) {
    return [...detected];
  }
  const eastAfter = detected
    .slice(entryIdx + 1)
    .filter(isGuadalajaraEastRingPlaza);
  if (eastAfter.length === 0) {
    return [...detected];
  }

  // Destino en Tonalá/Zapotlanejo u oriente: conservar casetas del anillo.
  if (destination.lon > GDL_EAST_APPROACH_LNG) {
    return [...detected];
  }

  return detected.filter((hit, index) => {
    if (index <= entryIdx) {
      return true;
    }
    return !isGuadalajaraEastRingPlaza(hit);
  });
}

export function needsColimaEntryViaRepair(
  detected: readonly DetectedTollPlaza[],
): boolean {
  const entryIdx = detected.findIndex(isColimaGuadalajaraEntryPlaza);
  if (entryIdx < 0) {
    return false;
  }
  return detected.slice(entryIdx + 1).some(isGuadalajaraEastRingPlaza);
}

export function colimaEntryViaPoint(
  detected: readonly DetectedTollPlaza[],
): { lat: number; lon: number } | null {
  const entry = detected.find(isColimaGuadalajaraEntryPlaza);
  if (!entry) {
    return null;
  }
  return { lat: entry.plaza.lat, lon: entry.plaza.lng };
}
