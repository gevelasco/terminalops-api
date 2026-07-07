import { FleetResourceGuardService } from './fleet-resource-guard.service';

describe('FleetResourceGuardService', () => {
  it('assertResourceActive rejects inactive resources', () => {
    const service = new FleetResourceGuardService();
    expect(() => service.assertResourceActive(false, 'Unit')).toThrow(
      'Unit is inactive and cannot be assigned',
    );
  });
});
