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
    expect(merged.map((p) => p.plazaKey)).toEqual(['a', 'b', 'c']);
    expect(merged.map((p) => p.order)).toEqual([1, 2, 3]);
  });
});