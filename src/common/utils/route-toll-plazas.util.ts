export type RouteTollPlazaPersistedRow = {
  order: number;
  plazaKey: string;
  /** `catalog` = catálogo propio; valores legacy `inegi`/`fallback` se conservan al leer. */
  plazaKeySource?: 'catalog' | 'inegi' | 'fallback';
  /** Coordenadas `"lat,lng"` (nombre histórico; ya no depende de INEGI). */
  inegiPoint?: string;
  name: string;
  section?: string;
  costMxn: number | null;
  municipality?: string;
  state?: string;
};

export function normalizeRouteTollPlazas(raw: unknown): RouteTollPlazaPersistedRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: RouteTollPlazaPersistedRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const plazaKey = String(row.plazaKey ?? '').trim();
    const name = String(row.name ?? '').trim();
    if (!plazaKey || !name) {
      continue;
    }
    const orderRaw = Number(row.order);
    const order = Number.isFinite(orderRaw) ? orderRaw : out.length + 1;
    const costRaw = row.costMxn;
    const costMxn =
      costRaw == null || costRaw === ''
        ? null
        : Number.isFinite(Number(costRaw))
          ? Number(costRaw)
          : null;
    const source = String(row.plazaKeySource ?? '').trim();
    const inegiPoint = String(row.inegiPoint ?? '').trim();
    const section = String(row.section ?? '').trim();
    const municipality = String(row.municipality ?? '').trim();
    const state = String(row.state ?? '').trim();
    out.push({
      order,
      plazaKey,
      ...(source === 'catalog' || source === 'inegi' || source === 'fallback'
        ? { plazaKeySource: source as 'catalog' | 'inegi' | 'fallback' }
        : {}),
      ...(inegiPoint ? { inegiPoint } : {}),
      ...(section ? { section } : {}),
      ...(municipality ? { municipality } : {}),
      ...(state ? { state } : {}),
      name,
      costMxn,
    });
  }
  return out.sort((a, b) => a.order - b.order);
}