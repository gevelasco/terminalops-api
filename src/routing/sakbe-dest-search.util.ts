/** Texto para `buscadestino` (localidad + municipio/estado). */
export function sakbeDestSearchLabel(
  locality: string | undefined,
  cityMunicipality: string | undefined,
): string {
  const loc = (locality ?? '').trim();
  const place = (cityMunicipality ?? '').trim();
  if (loc && place) {
    return `${loc}, ${place}`;
  }
  return loc || place;
}