import {
  feedItemVisibleForNotificationModules,
  resolveEffectiveNotificationFeedModules,
} from './notification-feed-preferences.util';

describe('notification-feed-preferences.util', () => {
  it('defaults to notifiable allowed modules when unset', () => {
    const enabled = resolveEffectiveNotificationFeedModules(null, [
      'trips',
      'fleet',
      'dashboard',
    ]);
    expect([...enabled].sort()).toEqual(['fleet', 'trips']);
  });

  it('filters feed items by module', () => {
    const enabled = new Set(['fleet']);
    expect(
      feedItemVisibleForNotificationModules(
        { kind: 'trip.reminder.load', entityType: 'trip' },
        enabled,
      ),
    ).toBe(false);
    expect(
      feedItemVisibleForNotificationModules(
        { kind: 'unit.updated', entityType: 'unit' },
        enabled,
      ),
    ).toBe(true);
  });

  it('routes destination rate kinds to destination_rates module', () => {
    const clientsOnly = new Set(['clients']);
    const ratesOnly = new Set(['destination_rates']);
    expect(
      feedItemVisibleForNotificationModules(
        { kind: 'destination_rate.updated', entityType: 'destination_rate' },
        clientsOnly,
      ),
    ).toBe(false);
    expect(
      feedItemVisibleForNotificationModules(
        { kind: 'destination_rate.updated', entityType: 'destination_rate' },
        ratesOnly,
      ),
    ).toBe(true);
    expect(
      feedItemVisibleForNotificationModules(
        { kind: 'client.updated', entityType: 'client' },
        ratesOnly,
      ),
    ).toBe(false);
  });
});