/**
 * Claves para el catálogo de casetas. INEGI cambia tarifa por ejes pero el
 * `inegiPoint` (lat,lon) identifica la caseta física.
 */
export function tollPlazaCatalogKeySuffix(plazaKey: string): string | null {
  const m = /:(mxn[\d.]+:o\d+)$/.exec(plazaKey.trim());
  return m?.[1] ?? null;
}

export function tollPlazaCatalogPointKey(inegiPoint: string): string {
  return `point:${inegiPoint.trim()}`;
}

export type TollPlazaCatalogLookupInput = {
  plazaKey: string;
  inegiPoint?: string;
};

export function tollPlazaCatalogLookupKeys(
  input: TollPlazaCatalogLookupInput | string,
): string[] {
  const plazaKey =
    typeof input === 'string' ? input.trim() : input.plazaKey.trim();
  const inegiPoint =
    typeof input === 'string' ? undefined : input.inegiPoint?.trim();
  if (!plazaKey) {
    return inegiPoint ? [tollPlazaCatalogPointKey(inegiPoint)] : [];
  }
  const keys = [plazaKey];
  const suffix = tollPlazaCatalogKeySuffix(plazaKey);
  if (suffix && !keys.includes(suffix)) {
    keys.push(suffix);
  }
  if (inegiPoint) {
    const pointKey = tollPlazaCatalogPointKey(inegiPoint);
    if (!keys.includes(pointKey)) {
      keys.push(pointKey);
    }
  }
  return keys;
}

/** Catálogo de sistema (todas las empresas) mientras INEGI devuelve N/D. */
export const SAKBE_BUILTIN_TOLL_PLAZA_ALIASES: Readonly<Record<string, string>> =
  {
    'point:19.40913,-103.52776': 'San Marcos',
    'point:19.93323,-103.52976': 'Sayula',
    'inegi:19.40913,-103.52776:mxn695:o2': 'San Marcos',
    'inegi:19.93323,-103.52976:mxn301:o3': 'Sayula',
    'inegi:hce1ccab165c1fa04b338:mxn523:o2': 'San Marcos',
    'inegi:hce1ccab165c1fa04b338:mxn223:o3': 'Sayula',
    'inegi:19.05200,-104.31900:mxn523:o2': 'San Marcos',
    'inegi:19.05200,-104.31900:mxn223:o3': 'Sayula',
  };

export function builtinTollPlazaDisplayName(
  input: TollPlazaCatalogLookupInput | string,
): string | undefined {
  for (const key of tollPlazaCatalogLookupKeys(input)) {
    const name = SAKBE_BUILTIN_TOLL_PLAZA_ALIASES[key];
    if (name) {
      return name;
    }
  }
  return undefined;
}