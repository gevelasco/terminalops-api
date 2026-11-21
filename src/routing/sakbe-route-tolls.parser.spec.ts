import {
  sakbeTollPlazaTotalMxn,
  sakbeTollPlazasFromRouteDetail,
} from './sakbe-route-tolls.parser';

describe('sakbe-route-tolls.parser', () => {
  it('keeps order and sums known costs', () => {
    const rows = sakbeTollPlazasFromRouteDetail([
      { direccion: 'Caseta de cobro Acaponeta', costo_caseta: 120 },
      { direccion: 'Continúe derecho', costo_caseta: 0 },
      { direccion: 'Caseta de cobro Pátzcuaro', costo_caseta: 85.5 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.name).toBe('Acaponeta');
    expect(rows[0]?.plazaKey).toBeTruthy();
    expect(rows[1]?.order).toBe(2);
    expect(sakbeTollPlazaTotalMxn(rows)).toBe(205.5);
  });
});