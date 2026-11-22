import {
  isInTripMilestoneReminderWindow,
  tripMilestoneRemindersDue,
} from './trip-milestone-reminder.util';
import type { Trip } from 'src/trips/entities/trip.entity';

function tripFixture(partial: Partial<Trip>): Trip {
  return {
    id: 1,
    companyId: 1,
    maneuverCode: 'TST-1',
    clientName: 'Cliente',
    status: 'scheduled',
    plannedDepartureAt: new Date('2026-11-24T07:10:00.000Z'),
    plannedArrivalAt: new Date('2026-11-25T16:00:00.000Z'),
    plannedCompletionAt: new Date('2026-11-27T02:10:00.000Z'),
    ...partial,
  } as Trip;
}

describe('trip-milestone-reminder.util', () => {
  it('fires within the hour before the event', () => {
    const eventAt = new Date('2026-11-23T17:00:00.000Z');
    const nowMs = new Date('2026-11-23T16:30:00.000Z').getTime();
    expect(isInTripMilestoneReminderWindow(eventAt, nowMs)).toBe(true);
    expect(
      isInTripMilestoneReminderWindow(
        eventAt,
        new Date('2026-11-23T18:00:00.000Z').getTime(),
      ),
    ).toBe(false);
  });

  it('emits load reminder for scheduled trip', () => {
    const loadAt = new Date('2026-11-23T17:00:00.000Z');
    const nowMs = new Date('2026-11-23T16:15:00.000Z').getTime();
    const trip = tripFixture({ loadDate: loadAt });
    const due = tripMilestoneRemindersDue(trip, nowMs);
    expect(due.map((d) => d.milestone)).toContain('load');
  });
});