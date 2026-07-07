const OPERATIONAL_TZ_OFFSET = '-06:00';

/** Convierte `YYYY-MM-DD` (fecha operativa) a instante sin caer en el día anterior en México. */
export function parseOperationalIncurredAt(raw: string): Date {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00${OPERATIONAL_TZ_OFFSET}`);
  }
  return new Date(trimmed);
}

/** Fecha operativa `YYYY-MM-DD` en zona horaria de México. */
export function formatOperationalIncurredDateYmd(incurredAt: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(incurredAt);
}
