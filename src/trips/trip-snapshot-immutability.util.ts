import { BadRequestException } from '@nestjs/common';
import type { Trip } from 'src/trips/entities/trip.entity';

export const TRIP_SNAPSHOT_IMMUTABLE_MESSAGE =
  'Trips are immutable snapshots and cannot modify historical route data';

/** Campos WORM de ruta/tarifa congelados al crear la maniobra (A4). */
export const TRIP_SNAPSHOT_IMMUTABLE_DTO_FIELDS = [
  'origin',
  'destination',
  'originPostalCode',
  'originCityMunicipality',
  'originLocality',
  'destinationPostalCode',
  'destinationCityMunicipality',
  'destinationLocality',
  'destinationRateId',
  'routeDistanceKm',
  'originOperationalCenterId',
] as const;

const IMMUTABLE_BODY_KEYS = new Set<string>([
  ...TRIP_SNAPSHOT_IMMUTABLE_DTO_FIELDS,
  'origin_postal_code',
  'origin_city_municipality',
  'origin_locality',
  'destination_postal_code',
  'destination_city_municipality',
  'destination_locality',
  'destination_rate_id',
  'route_distance_km',
  'origin_operational_center_id',
]);

export function assertNoSnapshotMutation(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (IMMUTABLE_BODY_KEYS.has(key)) {
      throw new BadRequestException(TRIP_SNAPSHOT_IMMUTABLE_MESSAGE);
    }
  }
}

export function assertNoSnapshotMutationDto(dto: object): void {
  const record = dto as Record<string, unknown>;
  for (const key of TRIP_SNAPSHOT_IMMUTABLE_DTO_FIELDS) {
    if (record[key] !== undefined) {
      throw new BadRequestException(TRIP_SNAPSHOT_IMMUTABLE_MESSAGE);
    }
  }
}

/** Bloquea cambio de tarifa cuando la maniobra ya tiene evidencia operativa/financiera. */
export function assertDestinationRateSnapshotLocked(
  trip: Pick<
    Trip,
    'destinationRateId' | 'clientCollectedAt' | 'status' | 'hasClientBilling'
  >,
  nextDestinationRateId: number | null | undefined,
): void {
  if (nextDestinationRateId === undefined) {
    return;
  }
  const current = trip.destinationRateId ?? null;
  const next = nextDestinationRateId ?? null;
  if (current === next) {
    return;
  }
  const confirmed =
    trip.clientCollectedAt != null ||
    trip.status === 'completed' ||
    trip.status === 'in_transit' ||
    (trip.destinationRateId != null && trip.hasClientBilling !== false);
  if (confirmed) {
    throw new BadRequestException(TRIP_SNAPSHOT_IMMUTABLE_MESSAGE);
  }
}
