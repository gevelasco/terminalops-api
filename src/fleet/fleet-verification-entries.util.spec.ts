import {
  mergeVerificationHistoryOnScalarSave,
  normalizeClearedVerificationScopes,
} from './fleet-verification-entries.util';

describe('fleet-verification-entries.util', () => {
  it('normalizes cleared scopes and drops unknown values', () => {
    expect(
      normalizeClearedVerificationScopes([
        'phys_mech',
        'phys_mech',
        'nope',
        'emissions',
      ]),
    ).toEqual(['phys_mech', 'emissions']);
  });

  it('removes history of cleared scopes without dropping other scopes', () => {
    expect(
      mergeVerificationHistoryOnScalarSave({
        previous: [
          { scope: 'phys_mech', date: '2025-01-10', cost: 800 },
          { scope: 'emissions', date: '2025-02-01', cost: 400 },
        ],
        incomingScalars: {},
        clearedScopes: ['phys_mech'],
      }),
    ).toEqual([{ scope: 'emissions', date: '2025-02-01', cost: 400 }]);
  });
});
