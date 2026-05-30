import { fetchDieselFromDatosGobCsv } from './fuel-price-external.providers';

describe('fetchDieselFromDatosGobCsv', () => {
  it('parses diesel rows and averages price', async () => {
    const csv = `Producto,Precio
Diesel,24.50
Gasolina,22.10
Diésel,25.00`;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => csv,
    }) as unknown as typeof fetch;

    const quote = await fetchDieselFromDatosGobCsv('https://example.com/prices.csv');
    expect(quote).not.toBeNull();
    expect(quote!.source).toBe('datos-gob-mx:csv:avg');
    expect(quote!.pricePerLiter).toBeCloseTo(24.75, 2);
  });
});
