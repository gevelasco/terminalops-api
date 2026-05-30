import {
  tripDieselPricePerLiterAtCreation,
  tripHistoricalDieselAmount,
} from './trip-diesel-price.util';

describe('trip-diesel-price.util', () => {
  it('prefers stored snapshot over derived', () => {
    expect(
      tripDieselPricePerLiterAtCreation({
        dieselPricePerLiterAtCreation: '24.5000',
        dieselLiters: '100',
        dieselAmount: '3000',
      }),
    ).toBe(24.5);
  });

  it('derives price from amount and liters when snapshot missing', () => {
    expect(
      tripDieselPricePerLiterAtCreation({
        dieselLiters: '10',
        dieselAmount: '255',
      }),
    ).toBe(25.5);
  });

  it('computes historical amount from snapshot', () => {
    expect(
      tripHistoricalDieselAmount({
        dieselLiters: '10',
        dieselPricePerLiterAtCreation: '24.5',
        dieselAmount: '999',
      }),
    ).toBe(245);
  });
});
