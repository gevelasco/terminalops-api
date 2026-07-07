import { assertFleetResourceAssignableForTrip } from './fleet-resource-assignable.util';

describe('assertFleetResourceAssignableForTrip', () => {
  it('rejects inactive resources', () => {
    expect(() =>
      assertFleetResourceAssignableForTrip({ isActive: false, status: 'available' }, 'Unit'),
    ).toThrow('Unit is inactive and cannot be assigned');
  });

  it('rejects units in maintenance', () => {
    expect(() =>
      assertFleetResourceAssignableForTrip({ isActive: true, status: 'maintenance' }, 'Unit'),
    ).toThrow('Unit is in maintenance and cannot be assigned to a trip');
  });

  it('allows available active resources', () => {
    expect(() =>
      assertFleetResourceAssignableForTrip({ isActive: true, status: 'available' }, 'Unit'),
    ).not.toThrow();
  });
});
