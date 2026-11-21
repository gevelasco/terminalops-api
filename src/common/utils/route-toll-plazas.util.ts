export type RouteTollPlazaPersistedRow = {
  order: number;
  plazaKey: string;
  plazaKeySource?: 'inegi' | 'fallback';
  inegiPoint?: string;
  name: string;
  costMxn: number | null;
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
    out.push({
      order,
      plazaKey,
      ...(source === 'inegi' || source === 'fallback'
        ? { plazaKeySource: source as 'inegi' | 'fallback' }
        : {}),
      ...(inegiPoint ? { inegiPoint } : {}),
      name,
      costMxn,
    });
  }
  return out.sort((a, b) => a.order - b.order);
}