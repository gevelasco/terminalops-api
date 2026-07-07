import { rejectClientFleetStatusMutation } from './fleet-status-lock.util';

describe('rejectClientFleetStatusMutation', () => {
  it('allows payloads without status', () => {
    expect(() =>
      rejectClientFleetStatusMutation({ plate: 'ABC', isActive: true }),
    ).not.toThrow();
  });

  it('rejects payloads that include status', () => {
    expect(() =>
      rejectClientFleetStatusMutation({ status: 'available' }),
    ).toThrow('status is system-owned and cannot be set via API');
  });
});
