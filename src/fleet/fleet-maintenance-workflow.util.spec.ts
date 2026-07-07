import {
  canPersistedStatusEnterMaintenance,
  canPersistedStatusLeaveMaintenance,
} from './fleet-maintenance-workflow.util';

describe('fleet-maintenance-workflow.util', () => {
  it('allows entering maintenance only from available', () => {
    expect(canPersistedStatusEnterMaintenance('available')).toBe(true);
    expect(canPersistedStatusEnterMaintenance('maintenance')).toBe(false);
    expect(canPersistedStatusEnterMaintenance('in_use')).toBe(false);
  });

  it('allows leaving maintenance only from maintenance', () => {
    expect(canPersistedStatusLeaveMaintenance('maintenance')).toBe(true);
    expect(canPersistedStatusLeaveMaintenance('available')).toBe(false);
  });
});
