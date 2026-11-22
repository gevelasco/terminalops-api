import { mergeSakbeTollPlazasLegs } from './sakbe-route-merge.util';
import type { SakbeTollPlazaRow } from './sakbe-route-tolls.parser';

function row(
  order: number,
  plazaKey: string,
  name = 'Caseta',
): SakbeTollPlazaRow {
  return {
    order,
    plazaKey,
    plazaKeySource: 'inegi',
    name,
    costMxn: 100,
  };
}

describe('mergeSakbeTollPlazasLegs', () => {
  it('preserves order and drops duplicate keys at leg joins', () => {
    const merged = mergeSakbeTollPlazasLegs([
      [row(1, 'a', 'A'), row(2, 'b', 'B')],
      [row(1, 'b', 'B'), row(2, 'c', 'C')],
    ]);
    expect(merged.map((p) => p.name)).toEqual(['A', 'B', 'C']);
    expect(merged.map((p) => p.order)).toEqual([1, 2, 3]);
  });

  it('keeps two plazas when punto_caseta hash collides but names differ', () => {
    const hash = 'hdeadbeefdeadbeefdead';
    const merged = mergeSakbeTollPlazasLegs([
      [
        {
          order: 1,
          plazaKey: `inegi:${hash}:d11111111:mxn120:o1`,
          plazaKeySource: 'inegi',
          name: 'Cuyutlan',
          costMxn: 120,
        },
        {
          order: 2,
          plazaKey: `inegi:${hash}:d22222222:mxn523:o2`,
          plazaKeySource: 'inegi',
          name: 'San Marcos',
          costMxn: 523,
        },
      ],
    ]);
    expect(merged.map((p) => p.name)).toEqual(['Cuyutlan', 'San Marcos']);
  });
});