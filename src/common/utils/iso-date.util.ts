/** Serializa fechas de TypeORM/Postgres a ISO 8601 para JSON. */
export function toIsoString(value?: Date | string | null): string {
  if (value == null) {
    return new Date().toISOString();
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
}
