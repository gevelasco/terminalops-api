import {
  fleetTargetsForActiveTripStatus,
  fleetTargetsWhenNoActiveTrips,
  isProtectedFleetStatus,
  pickDominantActiveTripStatus,
  resolveFleetTargetForResource,
} from './trip-fleet-status-sync.util';

describe('trip-fleet-status-sync.util', () => {
  it('pickDominantActiveTripStatus prefers in_transit over scheduled', () => {
    expect(pickDominantActiveTripStatus(['scheduled', 'in_transit'])).toBe(
      'in_transit',
    );
    expect(pickDominantActiveTripStatus(['scheduled'])).toBe('scheduled');
    expect(pickDominantActiveTripStatus([])).toBeNull();
  });

  it('fleetTargetsForActiveTripStatus maps scheduled and in_transit', () => {
    expect(fleetTargetsForActiveTripStatus('scheduled')).toEqual({
      unit: 'scheduled',
      operator: 'scheduled',
      equipment: 'scheduled',
    });
    expect(fleetTargetsForActiveTripStatus('in_transit')).toEqual({
      unit: 'in_use',
      operator: 'on_route',
      equipment: 'in_use',
    });
  });

  it('resolveFleetTargetForResource releases to available when no active trips', () => {
    expect(resolveFleetTargetForResource('unit', [])).toBe('available');
    expect(resolveFleetTargetForResource('operator', [])).toBe('available');
    expect(fleetTargetsWhenNoActiveTrips()).toEqual({
      unit: 'available',
      operator: 'available',
      equipment: 'available',
    });
  });

  it('resolveFleetTargetForResource keeps scheduled when another trip is active', () => {
    expect(resolveFleetTargetForResource('unit', ['scheduled'])).toBe(
      'scheduled',
    );
    expect(resolveFleetTargetForResource('operator', ['in_transit'])).toBe(
      'on_route',
    );
  });

  it('isProtectedFleetStatus blocks maintenance and HR states', () => {
    expect(isProtectedFleetStatus('unit', 'maintenance')).toBe(true);
    expect(isProtectedFleetStatus('unit', 'available')).toBe(false);
    expect(isProtectedFleetStatus('operator', 'leave')).toBe(true);
    expect(isProtectedFleetStatus('operator', 'on_route')).toBe(false);
    expect(isProtectedFleetStatus('equipment', 'maintenance')).toBe(true);
  });
});
