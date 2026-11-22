import { createHash } from 'node:crypto';

/** Lat/lon redondeados, hash del payload, o null si vacío. */
export function inegiPuntoCasetaFingerprint(raw: string): string | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  try {
    const json = JSON.parse(t) as { coordinates?: unknown };
    const coords = json?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return `${lat.toFixed(5)},${lon.toFixed(5)}`;
      }
    }
  } catch {
    // GeoJSON incompleto en respuesta INEGI
  }
  const wkt = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(t);
  if (wkt) {
    const lon = Number(wkt[1]);
    const lat = Number(wkt[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return `${lat.toFixed(5)},${lon.toFixed(5)}`;
    }
  }
  return `h${createHash('sha256').update(t).digest('hex').slice(0, 20)}`;
}

/**
 * Clave de catálogo estable y distinta por caseta en la ruta.
 * INEGI a veces repite el mismo `punto_caseta` (o GeoJSON truncado); se añaden tarifa y orden.
 */
export function tollPlazaCatalogKey(params: {
  puntoCaseta: string;
  order: number;
  costMxn: number | null;
  direccion: string;
}): {
  plazaKey: string;
  plazaKeySource: 'inegi' | 'fallback';
  inegiPoint?: string;
} {
  const point = params.puntoCaseta.trim();
  const cost =
    params.costMxn != null && Number.isFinite(params.costMxn)
      ? String(params.costMxn)
      : '0';
  const dirHash = createHash('sha256')
    .update(params.direccion.trim().toLowerCase())
    .digest('hex')
    .slice(0, 8);

  if (point) {
    const fp = inegiPuntoCasetaFingerprint(point);
    const coordLike = fp != null && !fp.startsWith('h');
    const plazaKey =
      fp != null && fp.startsWith('h')
        ? `inegi:${fp}:d${dirHash}:mxn${cost}:o${params.order}`
        : `inegi:${fp ?? 'unknown'}:mxn${cost}:o${params.order}`;
    return {
      plazaKey,
      plazaKeySource: 'inegi',
      ...(coordLike && fp ? { inegiPoint: fp } : {}),
    };
  }

  return {
    plazaKey: `inegi:seq:mxn${cost}:o${params.order}:d${dirHash}`,
    plazaKeySource: 'fallback',
  };
}