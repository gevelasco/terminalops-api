import type { Trip } from 'src/trips/entities/trip.entity';

export type TripLinkOptionDto = {
  id: number;
  maneuverCode: string;
  status: string;
  falseManeuver: boolean;
  plannedDepartureAt: string;
};

export function mapTripLinkOption(trip: Trip): TripLinkOptionDto {
  return {
    id: trip.id,
    maneuverCode: trip.maneuverCode?.trim() || String(trip.id),
    status: trip.status,
    falseManeuver: trip.falseManeuver === true,
    plannedDepartureAt: trip.plannedDepartureAt.toISOString(),
  };
}
