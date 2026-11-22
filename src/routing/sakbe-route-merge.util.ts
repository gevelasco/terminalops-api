import type { SakbeTollPlazaRow } from './sakbe-route-tolls.parser';

/**
 * Une casetas de varios tramos en orden de recorrido.
 * Deduplica solo cruces repetidos (misma `plazaKey` en unión de tramos).
 */
export function mergeSakbeTollPlazasLegs(
  legs: readonly (readonly SakbeTollPlazaRow[])[],
): SakbeTollPlazaRow[] {
  const merged: SakbeTollPlazaRow[] = [];
  const seen = new Set<string>();
  for (const leg of legs) {
    for (const plaza of leg) {
      const key = plaza.plazaKey.trim();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push({
        ...plaza,
        order: merged.length + 1,
      });
    }
  }
  return merged;
}