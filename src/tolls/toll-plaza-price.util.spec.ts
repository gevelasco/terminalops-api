import {
  tollPlazaCatalogKey,
  tollPlazaCostMxnForAxles,
  tollPlazaPriceColumnForAxles,
} from './toll-plaza-price.util';
import type { TollPlaza } from './entities/toll-plaza.entity';

function plaza(partial: Partial<TollPlaza>): TollPlaza {
  return {
    plazaId: 1,
    name: 'Test',
    lat: 19,
    lng: -99,
    sourceYear: 2025,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as TollPlaza;
}

describe('toll-plaza-price.util', () => {
  it('maps axle counts to camion columns', () => {
    expect(tollPlazaPriceColumnForAxles(2)).toBe('tCamion2');
    expect(tollPlazaPriceColumnForAxles(5)).toBe('tCamion5');
    expect(tollPlazaPriceColumnForAxles(9)).toBe('tCamion9');
    expect(tollPlazaPriceColumnForAxles(12)).toBe('tCamion9');
    expect(tollPlazaPriceColumnForAxles(undefined)).toBe('tCamion5');
  });

  it('reads cost and treats 0/null as missing', () => {
    const row = plaza({ tCamion5: '219.00', tCamion2: '0' });
    expect(tollPlazaCostMxnForAxles(row, 5)).toBe(219);
    expect(tollPlazaCostMxnForAxles(row, 2)).toBeNull();
    expect(tollPlazaCatalogKey(42)).toBe('plaza:42');
  });
});
