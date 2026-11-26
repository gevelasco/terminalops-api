import { detectTollPlazasAlongRoute } from './route-toll-detect.util';
import type { TollPlaza } from './entities/toll-plaza.entity';

function plaza(
  id: number,
  lat: number,
  lng: number,
  name = `P${id}`,
  section?: string,
): TollPlaza {
  return {
    plazaId: id,
    name,
    section,
    lat,
    lng,
    sourceYear: 2025,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TollPlaza;
}

describe('detectTollPlazasAlongRoute', () => {
  it('detects plazas near the line and orders by distance from origin', () => {
    const route: [number, number][] = [
      [-99.01, 19.0],
      [-99.0, 19.0],
      [-98.99, 19.0],
    ];
    const onRouteEarly = plaza(1, 19.0, -99.005);
    const onRouteLate = plaza(2, 19.0, -98.995);
    const farAway = plaza(3, 20.5, -99.0);
    const hits = detectTollPlazasAlongRoute(route, [
      onRouteLate,
      farAway,
      onRouteEarly,
    ]);
    expect(hits.map((h) => h.plaza.plazaId)).toEqual([1, 2]);
    expect(hits[0]!.kmAlongRoute).toBeLessThan(hits[1]!.kmAlongRoute);
  });

  it('ignores plazas beyond the route tolerance', () => {
    const route: [number, number][] = [
      [-99.0, 19.0],
      [-98.99, 19.0],
    ];
    // ~0.002° latitude ≈ 220 m — outside 40 m
    const nearButOutside = plaza(9, 19.002, -99.0);
    expect(detectTollPlazasAlongRoute(route, [nearButOutside])).toEqual([]);
  });

  it('collapses opposite-direction duplicates of the same plaza', () => {
    const route: [number, number][] = [
      [-104.082, 18.9278],
      [-104.081, 18.9278],
      [-104.080, 18.9278],
    ];
    const a = plaza(963, 18.92782867, -104.0814146, 'Cuyutlán');
    // ~120 m away — still same physical plaza / other carriageway
    const b = plaza(964, 18.9287, -104.0822, 'Cuyutlán');
    const hits = detectTollPlazasAlongRoute(route, [a, b]);
    expect(hits).toHaveLength(1);
  });
});
