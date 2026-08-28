import { COMPANY_ACTIVITY_KIND } from './company-activity-event.kinds';
import { fleetMetaPatchSection, fleetPatchActivity } from './activity-events.fleet.util';

describe('fleetMetaPatchSection', () => {
  it('labels insurance, gps and verification as coverage', () => {
    expect(
      fleetMetaPatchSection({
        insuranceCarrierName: 'Qualitas',
        insuranceCost: 12000,
      }),
    ).toBe('coverage');
    expect(
      fleetMetaPatchSection({
        hasGps: true,
        gpsProviderBrand: 'Samsara',
      }),
    ).toBe('coverage');
    expect(
      fleetMetaPatchSection({
        verificationPhysMechDate: '2026-08-01',
        clearedVerificationScopes: ['phys_mech'],
      }),
    ).toBe('coverage');
  });

  it('labels maintenance entries as maintenance', () => {
    expect(
      fleetMetaPatchSection({
        maintenanceEntries: [{ date: '2026-08-01', type: 'Preventivo' }],
        tireCondition: 'Bueno',
      }),
    ).toBe('maintenance');
  });

  it('labels identity and tenure as ficha', () => {
    expect(
      fleetMetaPatchSection({
        trailerBrandName: 'Kenworth',
        trailerTenureMode: 'owned',
      }),
    ).toBe('ficha');
    expect(fleetMetaPatchSection(undefined)).toBe('ficha');
  });
});

describe('fleetPatchActivity', () => {
  it('uses unit coverage kind when saving verification', () => {
    expect(
      fleetPatchActivity('unit', {
        verificationPhysMechDate: '2026-08-01',
        verificationPhysMechCost: 1800,
      }),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.UNIT_COVERAGE_UPDATED,
      title: 'Cobertura',
    });
  });

  it('uses equipment ficha kind for identity patches', () => {
    expect(
      fleetPatchActivity('equipment', {
        trailerBrandName: 'Utility',
        trailerColor: 'Blanco',
      }),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.EQUIPMENT_FICHA_UPDATED,
      title: 'Ficha técnica',
    });
  });
});
