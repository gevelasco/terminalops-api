export const FLEET_LINK_OPTIONS_MIN_SEARCH_LENGTH = 3;

export function isFleetLinkOptionsSearchAllowed(
  search: string | undefined,
): search is string {
  const normalized = search?.trim() ?? '';
  return normalized.length >= FLEET_LINK_OPTIONS_MIN_SEARCH_LENGTH;
}
