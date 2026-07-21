import {
  tripDieselPricePerLiterAtCreation,
  tripHistoricalDieselAmount,
} from './trip-diesel-price.util';

describe('trip-diesel-price.util', () => {
  it('derives price from amount and liters', () => {
    expect(
      tripDieselPricePerLiterAtCreation({
        dieselLiters: '10',
        dieselAmount: '255',
      }),
    ).toBe(25.5);
  });

  it('returns null when liters/amount missing', () => {
    expect(
      tripDieselPricePerLiterAtCreation({
        dieselLiters: '10',
      }),
    ).toBeNull();
  });

  it('computes historical amount from derived price', () => {
    expect(
      tripHistoricalDieselAmount({
        dieselLiters: '10',
        dieselAmount: '245',
      }),
    ).toBe(245);
  });

  it('falls back to stored amount when cannot derive', () => {
    expect(
      tripHistoricalDieselAmount({
        dieselAmount: '999',
      }),
    ).toBe(999);
  });
});
