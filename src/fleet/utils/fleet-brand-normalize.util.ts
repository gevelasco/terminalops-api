export type NormalizedFleetBrandName = {
  name: string;
  nameNormalized: string;
};

/** trim → colapsar espacios → lowercase para unicidad. */
export function normalizeFleetBrandName(raw: string): NormalizedFleetBrandName | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const name = collapseSpaces(trimmed);
  if (!name) {
    return null;
  }
  return { name, nameNormalized: name.toLowerCase() };
}

function collapseSpaces(value: string): string {
  const parts = value.split(' ').filter((part) => part.length > 0);
  return parts.join(' ');
}
