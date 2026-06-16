const COUNTRY_TOKENS = new Set([
  'méxico',
  'mexico',
  'mx',
  'estados unidos',
  'usa',
  'u.s.a.',
  'u.s.a',
]);

function stripParentheticals(value: string): string {
  return value.replace(/\([^)]*\)/g, '').trim();
}

function isPostalOrNoise(part: string): boolean {
  const t = part.trim().toLowerCase();
  if (!t) {
    return true;
  }
  if (/^cp\s*\d+/i.test(t)) {
    return true;
  }
  if (/^\d{4,6}$/.test(t)) {
    return true;
  }
  if (COUNTRY_TOKENS.has(t)) {
    return true;
  }
  return false;
}

export function formatCompactRouteEndpoint(raw: string): string {
  const cleaned = stripParentheticals(raw);
  if (!cleaned) {
    return '—';
  }

  const parts = cleaned
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !isPostalOrNoise(p));

  if (parts.length === 0) {
    return cleaned;
  }
  if (parts.length === 1) {
    return parts[0]!;
  }

  const state = parts[parts.length - 1]!;
  const city = parts[parts.length - 2]!;
  return `${city}, ${state}`;
}

export function formatCompactTripRouteLabel(
  origin: string,
  destination: string,
): string {
  return `${formatCompactRouteEndpoint(origin)} → ${formatCompactRouteEndpoint(destination)}`;
}
