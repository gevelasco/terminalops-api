import {
  fleetMetaFieldProvided,
  unitFleetMetaGpsConfigTouched,
  unitFleetMetaGpsPaymentDateTouched,
  unitFleetMetaGpsTouched,
  unitFleetMetaInsurancePaymentDateTouched,
  unitFleetMetaInsuranceTouched,
  unitFleetMetaVerificationTouched,
} from './fleet-meta-expense-sync-scope.util';

describe('fleet-meta-expense-sync-scope.util', () => {
  const previous = {
    insuranceLastPaymentDate: '2026-05-01',
    insuranceCost: '7500',
    gpsLastPaymentDate: '2026-05-01',
    gpsPrice: '788',
    hasGps: true,
  };

  it('detects insurance-only updates', () => {
    expect(
      unitFleetMetaInsuranceTouched(previous, {
        insuranceLastPaymentDate: '2026-06-01',
      }),
    ).toBe(true);
    expect(
      unitFleetMetaGpsTouched(previous, {
        insuranceLastPaymentDate: '2026-06-01',
      }),
    ).toBe(false);
  });

  it('detects gps-only updates', () => {
    expect(
      unitFleetMetaGpsTouched(previous, {
        gpsLastPaymentDate: '2026-06-01',
      }),
    ).toBe(true);
    expect(
      unitFleetMetaInsuranceTouched(previous, {
        gpsLastPaymentDate: '2026-06-01',
      }),
    ).toBe(false);
  });

  it('ignores numeric formatting drift on unrelated gps fields', () => {
    expect(
      unitFleetMetaGpsConfigTouched(previous, {
        gpsPrice: 788,
      }),
    ).toBe(false);
    expect(
      unitFleetMetaGpsPaymentDateTouched(previous, {
        insuranceLastPaymentDate: '2026-07-01',
      }),
    ).toBe(false);
    expect(
      unitFleetMetaInsurancePaymentDateTouched(previous, {
        insuranceLastPaymentDate: '2026-07-01',
      }),
    ).toBe(true);
  });

  it('ignores undefined dto fields from sparse nest patch', () => {
    const sparseNestPatch = {
      insuranceLastPaymentDate: '2026-07-01',
      gpsLastPaymentDate: undefined,
      gpsPrice: undefined,
      hasGps: undefined,
    };
    expect(fleetMetaFieldProvided(sparseNestPatch, 'insuranceLastPaymentDate')).toBe(
      true,
    );
    expect(fleetMetaFieldProvided(sparseNestPatch, 'gpsLastPaymentDate')).toBe(false);
    expect(unitFleetMetaGpsPaymentDateTouched(previous, sparseNestPatch)).toBe(false);
    expect(unitFleetMetaGpsConfigTouched(previous, sparseNestPatch)).toBe(false);
    expect(unitFleetMetaInsurancePaymentDateTouched(previous, sparseNestPatch)).toBe(
      true,
    );
  });

  it('normalizes date prefixes before comparing payment dates', () => {
    expect(
      unitFleetMetaGpsPaymentDateTouched(
        { gpsLastPaymentDate: '2026-06-01' },
        { gpsLastPaymentDate: '2026-06-01T12:00:00.000Z' },
      ),
    ).toBe(false);
  });

  it('detects verificationEntries array in incoming dto', () => {
    expect(
      unitFleetMetaVerificationTouched(
        { verificationPhysMechDate: '2026-05-01' },
        { verificationEntries: [{ scope: 'phys_mech', date: '2026-06-01' }] },
      ),
    ).toBe(true);
  });
});
