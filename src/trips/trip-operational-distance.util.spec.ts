import {
  operationalKmFromStoredTrip,
  resolveTripOperationalDistance,
} from './trip-operational-distance.util';

describe('trip-operational-distance.util', () => {
  it('doubles distance for round trip by default', () => {
    const d = resolveTripOperationalDistance(100);
    expect(d.routeDistanceKm).toBe(100);
    expect(d.operationalDistanceKm).toBe(200);
    expect(d.roundTripFactor).toBe(2);
  });

  it('keeps one-way when isRoundTrip is false', () => {
    const d = resolveTripOperationalDistance(100, false);
    expect(d.operationalDistanceKm).toBe(100);
  });

  it('resolves legacy stored trips without operational column', () => {
    expect(operationalKmFromStoredTrip(100, null, true)).toBe(200);
    expect(operationalKmFromStoredTrip(100, 200, true)).toBe(200);
  });

  it('honours isRoundTrip false (no implicit cultural default)', () => {
    expect(resolveTripOperationalDistance(100, false).operationalDistanceKm).toBe(100);
    expect(resolveTripOperationalDistance(100, undefined).operationalDistanceKm).toBe(200);
    expect(resolveTripOperationalDistance(100).isRoundTrip).toBe(true);
  });
});
