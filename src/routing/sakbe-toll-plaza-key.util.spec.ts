import { tollPlazaCatalogKey } from './sakbe-toll-plaza-key.util';

describe('sakbe-toll-plaza-key.util', () => {
  const sharedGeo =
    '{"type":"Point","coordinates":[-104.319,19.052]}';

  it('generates distinct keys for same geometry with different tariffs', () => {
    const a = tollPlazaCatalogKey({
      puntoCaseta: sharedGeo,
      order: 2,
      costMxn: 523,
      direccion: 'Cruce la caseta N/D',
    });
    const b = tollPlazaCatalogKey({
      puntoCaseta: sharedGeo,
      order: 3,
      costMxn: 223,
      direccion: 'Cruce la caseta N/D',
    });
    expect(a.plazaKey).not.toBe(b.plazaKey);
    expect(a.plazaKey).toContain('mxn523');
    expect(b.plazaKey).toContain('mxn223');
  });

  it('does not truncate geojson prefix into identical keys', () => {
    const truncated =
      '{"type":"Point","crs":{"type":"name","properties":{"name":"inegi';
    const keys = new Set(
      [523, 223].map((cost, i) =>
        tollPlazaCatalogKey({
          puntoCaseta: truncated,
          order: i + 2,
          costMxn: cost,
          direccion: 'N/D',
        }).plazaKey,
      ),
    );
    expect(keys.size).toBe(2);
  });
});