/**
 * Nombre corto para bitácora y etiquetas: primer nombre + primer apellido.
 * - 1 token → ese token
 * - 2 tokens → ambos
 * - 3+ → primer token + penúltimo (apellido paterno antes del materno)
 */
export function formatPersonShortName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length === 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return `${parts[0]} ${parts[parts.length - 2]}`;
}
