/** Recurso de flota listo para asignar a una nueva maniobra. */
export const FLEET_ASSIGNABLE_LIST_STATUS = 'available';

export type FleetListAvailableOptions = {
  available?: boolean;
};

export function parseAvailableQuery(value?: string): boolean {
  const v = value?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
