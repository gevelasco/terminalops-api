import {
  operationalKmFromStoredTrip,
  resolveTripOperationalDistance,
} from './trip-operational-distance.util';

describe('trip-operational-distance.util', () => {
  it('always doubles distance (ida+vuelta)', () => {
    const d = resolveTripOperationalDistance(100);
    expect(d.routeDistanceKm).toBe(100);
    expect(d.operationalDistanceKm).toBe(200);
    expect(d.roundTripFactor).toBe(2);
    expect(d.isRoundTrip).toBe(true);
  });

  it('ignores isRoundTrip false (trips always ×2)', () => {
    expect(resolveTripOperationalDistance(100, false).operationalDistanceKm).toBe(200);
    expect(resolveTripOperationalDistance(100, undefined).operationalDistanceKm).toBe(200);
  });

  it('resolves operational km from route only', () => {
    expect(operationalKmFromStoredTrip(100)).toBe(200);
    expect(operationalKmFromStoredTrip(100, 999, false)).toBe(200);
    expect(operationalKmFromStoredTrip(null)).toBeNull();
  });
});
