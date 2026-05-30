export function normalizeOperationConfigCode(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeOperationConfigName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}
