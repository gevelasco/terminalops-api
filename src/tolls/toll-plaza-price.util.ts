import type { TollPlaza } from './entities/toll-plaza.entity';

/** Columna de tarifa camión según ejes del tracto (2–9). */
export function tollPlazaPriceColumnForAxles(
  axleCount: number | undefined,
): keyof Pick<
  TollPlaza,
  | 'tCamion2'
  | 'tCamion3'
  | 'tCamion4'
  | 'tCamion5'
  | 'tCamion6'
  | 'tCamion7'
  | 'tCamion8'
  | 'tCamion9'
> {
  const n =
    axleCount != null && Number.isFinite(axleCount) ? Math.round(axleCount) : 5;
  if (n <= 2) return 'tCamion2';
  if (n === 3) return 'tCamion3';
  if (n === 4) return 'tCamion4';
  if (n === 5) return 'tCamion5';
  if (n === 6) return 'tCamion6';
  if (n === 7) return 'tCamion7';
  if (n === 8) return 'tCamion8';
  return 'tCamion9';
}

export function tollPlazaCostMxnForAxles(
  plaza: TollPlaza,
  axleCount: number | undefined,
): number | null {
  const col = tollPlazaPriceColumnForAxles(axleCount);
  const raw = plaza[col];
  if (raw == null || raw === '') {
    return null;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return Math.round(n * 100) / 100;
}

export function tollPlazaCatalogKey(plazaId: number): string {
  return `plaza:${plazaId}`;
}
