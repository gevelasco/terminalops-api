/** Límite documentado de SAKBÉ para el parámetro `buscar` en `buscadestino`. */
export const SAKBE_BUSCADESTINO_MAX_CHARS = 48;

export function sakbeStripAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[´`']/g, "'")
    .trim();
}

/** Candidatos de búsqueda, del más corto al más específico (todos ≤ límite). */
export function sakbeBuscadestinoCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  const candidates: string[] = [];

  const push = (value: string): void => {
    const plain = sakbeStripAccents(value).trim();
    if (!plain || plain.length > SAKBE_BUSCADESTINO_MAX_CHARS) {
      return;
    }
    candidates.push(plain);
    const upper = plain.toUpperCase();
    if (upper !== plain && upper.length <= SAKBE_BUSCADESTINO_MAX_CHARS) {
      candidates.push(upper);
    }
  };

  if (parts.length >= 2) {
    push(parts.slice(-2).join(', '));
  }
  if (parts.length >= 3) {
    push(parts.slice(1).join(', '));
  }
  if (parts.length >= 1) {
    push(parts[parts.length - 1]!);
  }
  push(trimmed);

  const unique = [...new Set(candidates)];
  // Más específico primero: "Manzanillo, Colima" antes que "Colima" (evita anclar
  // el origen en la capital del estado y saltar casetas costeras).
  return unique.sort((a, b) => b.length - a.length);
}

export function isSakbeSearchLengthError(message: string): boolean {
  return /longitud.*busqueda|búsqueda.*l[ií]mite/i.test(message);
}