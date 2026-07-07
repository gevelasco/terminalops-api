import { rejectClientTripStatusMutation } from './trip-status-lock.util';

describe('rejectClientTripStatusMutation', () => {
  it('allows payloads without status', () => {
    expect(() =>
      rejectClientTripStatusMutation({ unitId: '1', clientName: 'Acme' }),
    ).not.toThrow();
  });

  it('rejects status in request body with 400 message', () => {
    expect(() =>
      rejectClientTripStatusMutation({ status: 'in_transit' }),
    ).toThrow('Trip status is system-owned');
  });
});
