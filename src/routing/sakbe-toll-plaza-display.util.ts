export function formatSakbeTollPlazaName(raw: string): string {
  let t = raw.trim();
  if (!t) {
    return '';
  }
  t = t.replace(/^cruce\s+la\s+caseta\s+/i, '').trim();
  t = t.replace(/^caseta\s+de\s+cobro\s+/i, '').trim();
  return t.replace(/\s+/g, ' ').slice(0, 120);
}

export function isSakbeTollPlazaNameMissing(name: string): boolean {
  const t = name.trim().toLowerCase();
  return !t || t === 'n/d' || t === 'nd' || t === 's/d';
}