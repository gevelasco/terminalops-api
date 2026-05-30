/**
 * Prefijo de código de maniobra a partir del nombre del cliente.
 * Primera letra de cada palabra, máx. 3 letras, mayúsculas.
 * Ej.: «Acme de México» → ADM, «Transportes del Norte» → TDN
 */
export function maneuverCodePrefixFromClientName(name: string): string {
  const raw = name.trim();
  if (!raw) {
    return 'GN';
  }
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const letters = lettersOnly(words[0]).slice(0, 3);
    return letters || 'GN';
  }
  const prefix = words
    .map((word) => lettersOnly(word).charAt(0))
    .filter(Boolean)
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return prefix || 'GN';
}

export function formatManeuverCode(prefix: string, sequence: number): string {
  const safePrefix = prefix.trim().toUpperCase() || 'GN';
  const seq = Number.isFinite(sequence) && sequence > 0 ? sequence : 1;
  return `${safePrefix}-${String(seq).padStart(4, '0')}`;
}

function lettersOnly(value: string): string {
  return value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
}
