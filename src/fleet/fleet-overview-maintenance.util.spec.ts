import {
  buildMaintenanceSummary,
  nextMaintenanceDateLabel,
} from './fleet-overview-maintenance.util';

const kmPolicy = {
  kmControlEnabled: true,
  kmIntervalDefault: 100_000,
  dateControlEnabled: false,
  datePeriodMonths: 6,
};

const datePolicy = {
  kmControlEnabled: false,
  kmIntervalDefault: null,
  dateControlEnabled: true,
  datePeriodMonths: 6,
};

const meta = {
  lastMaintenanceDate: '2026-03-13',
  maintenanceKmCounter: 0,
};

describe('fleet-overview-maintenance policy exclusivity', () => {
  it('shows remaining km and does not invent a calendar date when policy is km', () => {
    expect(nextMaintenanceDateLabel(meta, kmPolicy)).toBe('100,000 km');
    expect(buildMaintenanceSummary(meta, kmPolicy).maintenanceRenewal).toBe('ok');
  });

  it('uses the calendar cycle only when policy is date', () => {
    expect(nextMaintenanceDateLabel(meta, datePolicy)).toMatch(/13\s+sep/i);
    expect(buildMaintenanceSummary(meta, datePolicy).maintenanceRenewal).not.toBe(
      'ok',
    );
  });

  it('does not evaluate dates when no policy is set', () => {
    expect(nextMaintenanceDateLabel(meta)).toBeNull();
    expect(buildMaintenanceSummary(meta).maintenanceRenewal).toBe('na');
  });
});
