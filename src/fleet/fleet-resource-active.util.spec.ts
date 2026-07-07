import { assertFleetResourceActive } from './fleet-resource-active.util';

describe('assertFleetResourceActive', () => {
  it('allows active resources', () => {
    expect(() => assertFleetResourceActive(true, 'Unit')).not.toThrow();
    expect(() => assertFleetResourceActive(undefined, 'Unit')).not.toThrow();
  });

  it('rejects inactive resources', () => {
    expect(() => assertFleetResourceActive(false, 'Unit')).toThrow(
      'Unit is inactive and cannot be assigned',
    );
  });
});
