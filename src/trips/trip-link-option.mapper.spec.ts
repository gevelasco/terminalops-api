import { mapTripLinkOption } from './trip-link-option.mapper';
import type { Trip } from 'src/trips/entities/trip.entity';

describe('trip-link-option.mapper', () => {
  it('mapTripLinkOption returns lightweight fields', () => {
    const row = mapTripLinkOption({
      id: 12,
      maneuverCode: 'PA-0005',
      status: 'completed',
      falseManeuver: false,
      plannedDepartureAt: new Date('2026-06-19T14:30:00.000Z'),
    } as Trip);

    expect(row).toEqual({
      id: 12,
      maneuverCode: 'PA-0005',
      status: 'completed',
      falseManeuver: false,
      plannedDepartureAt: '2026-06-19T14:30:00.000Z',
    });
  });
});
