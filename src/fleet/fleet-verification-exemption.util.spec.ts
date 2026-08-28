import {
  fleetModelTwoYearExemptionEndYmd,
  isWithinFleetModelTwoYearExemption,
} from './fleet-verification-exemption.util';

describe('fleet-verification-exemption.util', () => {
  it('ends exemption on 1 Jan of model year + 2', () => {
    expect(fleetModelTwoYearExemptionEndYmd('2026')).toBe('2028-01-01');
    expect(fleetModelTwoYearExemptionEndYmd(2025)).toBe('2027-01-01');
  });

  it('treats invalid years as not exempt', () => {
    expect(fleetModelTwoYearExemptionEndYmd('')).toBeNull();
    expect(fleetModelTwoYearExemptionEndYmd('abc')).toBeNull();
    expect(isWithinFleetModelTwoYearExemption('2026', '2028-01-01')).toBe(false);
  });

  it('is exempt until the day before the end date', () => {
    expect(isWithinFleetModelTwoYearExemption('2026', '2026-08-28')).toBe(true);
    expect(isWithinFleetModelTwoYearExemption('2026', '2027-12-31')).toBe(true);
    expect(isWithinFleetModelTwoYearExemption('2024', '2026-08-28')).toBe(false);
  });
});
