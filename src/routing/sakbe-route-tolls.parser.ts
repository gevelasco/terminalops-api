import {
  formatSakbeTollPlazaName,
  isSakbeTollPlazaNameMissing,
} from './sakbe-toll-plaza-display.util';
import { tollPlazaCatalogKey } from './sakbe-toll-plaza-key.util';

export type SakbeTollPlazaRow = {
  order: number;
  /** Clave estable (INEGI `punto_caseta` o respaldo por orden/tarifa). */
  plazaKey: string;
  /** `inegi` cuando viene `punto_caseta`; `fallback` si no hay id oficial. */
  plazaKeySource: 'inegi' | 'fallback';
  /** Coordenadas INEGI cuando se pudieron leer del punto. */
  inegiPoint?: string;
  name: string;
  costMxn: number | null;
};

type DetalleSegment = {
  direccion?: string;
  costo_caseta?: number | string | null;
  punto_caseta?: string | null;
};

function parseSegmentCost(raw: unknown): number | null {
  if (raw == null || raw === '') {
    return null;
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return Math.round(n * 100) / 100;
}

function tollNameFromDireccion(direccion: string): string {
  const formatted = formatSakbeTollPlazaName(direccion);
  if (formatted) {
    return formatted;
  }
  return isSakbeTollPlazaNameMissing(direccion) ? 'N/D' : 'Caseta';
}

/** Extrae casetas en orden del detalle de ruta (`detalle_c`). */
export function sakbeTollPlazasFromRouteDetail(
  segments: readonly DetalleSegment[] | null | undefined,
): SakbeTollPlazaRow[] {
  if (!Array.isArray(segments)) {
    return [];
  }
  const rows: SakbeTollPlazaRow[] = [];
  for (const seg of segments) {
    const cost = parseSegmentCost(seg.costo_caseta);
    const hasPoint =
      seg.punto_caseta != null && String(seg.punto_caseta).trim() !== '';
    const direccion = String(seg.direccion ?? '').trim();
    const looksLikeTollPlaza = /caseta|peaje|cuota|cruce\s+la\s+caseta/i.test(
      direccion,
    );
    if (cost == null && !hasPoint && !looksLikeTollPlaza) {
      continue;
    }
    const order = rows.length + 1;
    const key = tollPlazaCatalogKey({
      puntoCaseta: String(seg.punto_caseta ?? ''),
      order,
      costMxn: cost,
      direccion,
    });
    rows.push({
      order,
      plazaKey: key.plazaKey,
      plazaKeySource: key.plazaKeySource,
      ...(key.inegiPoint ? { inegiPoint: key.inegiPoint } : {}),
      name: tollNameFromDireccion(direccion),
      costMxn: cost,
    });
  }
  return rows;
}

export function sakbeTollPlazaTotalMxn(
  rows: readonly SakbeTollPlazaRow[],
  excludePlazaKeys?: readonly string[],
): number | null {
  const skip =
    excludePlazaKeys != null && excludePlazaKeys.length > 0
      ? new Set(excludePlazaKeys)
      : null;
  let sum = 0;
  let any = false;
  for (const row of rows) {
    if (skip?.has(row.plazaKey)) {
      continue;
    }
    if (row.costMxn != null) {
      sum += row.costMxn;
      any = true;
    }
  }
  return any ? Math.round(sum * 100) / 100 : null;
}