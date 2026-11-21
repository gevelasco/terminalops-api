import {
  builtinTollPlazaDisplayName,
  tollPlazaCatalogKeySuffix,
  tollPlazaCatalogLookupKeys,
  tollPlazaCatalogPointKey,
} from './sakbe-toll-plaza-catalog.util';

describe('sakbe-toll-plaza-catalog.util', () => {
  it('resolves 8-axle plazas by inegiPoint', () => {
    expect(
      builtinTollPlazaDisplayName({
        plazaKey: 'inegi:19.40913,-103.52776:mxn695:o2',
        inegiPoint: '19.40913,-103.52776',
      }),
    ).toBe('San Marcos');
    expect(
      builtinTollPlazaDisplayName({
        plazaKey: 'inegi:19.93323,-103.52976:mxn301:o3',
        inegiPoint: '19.93323,-103.52976',
      }),
    ).toBe('Sayula');
  });

  it('resolves aliases by coordinate-based plaza keys', () => {
    expect(
      builtinTollPlazaDisplayName('inegi:19.05200,-104.31900:mxn523:o2'),
    ).toBe('San Marcos');
  });

  it('exposes tariff/order suffix and point keys for lookup', () => {
    expect(
      tollPlazaCatalogKeySuffix('inegi:19.05200,-104.31900:mxn223:o3'),
    ).toBe('mxn223:o3');
    expect(tollPlazaCatalogPointKey('19.40913,-103.52776')).toBe(
      'point:19.40913,-103.52776',
    );
    expect(
      tollPlazaCatalogLookupKeys({
        plazaKey: 'inegi:foo:mxn100:o1',
        inegiPoint: '1,2',
      }),
    ).toEqual(['inegi:foo:mxn100:o1', 'mxn100:o1', 'point:1,2']);
  });
});