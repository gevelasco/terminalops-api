import {
  isInTripMilestoneReminderWindow,
  tripMilestoneReminderDedupeKey,
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
  it('fires only in the ~2m window exactly 1h before the event', () => {
    const eventAt = new Date('2026-11-23T17:00:00.000Z');
    expect(
      isInTripMilestoneReminderWindow(
        eventAt,
        new Date('2026-11-23T16:00:00.000Z').getTime(),
      ),
    ).toBe(true);
    expect(
      isInTripMilestoneReminderWindow(
        eventAt,
        new Date('2026-11-23T16:01:30.000Z').getTime(),
      ),
    ).toBe(true);
    expect(
      isInTripMilestoneReminderWindow(
        eventAt,
        new Date('2026-11-23T16:02:00.000Z').getTime(),
      ),
    ).toBe(false);
    expect(
      isInTripMilestoneReminderWindow(
        eventAt,
        new Date('2026-11-23T16:30:00.000Z').getTime(),
      ),
    ).toBe(false);
    expect(
      isInTripMilestoneReminderWindow(
        eventAt,
        new Date('2026-11-23T15:59:59.000Z').getTime(),
      ),
    ).toBe(false);
    expect(
      isInTripMilestoneReminderWindow(
        eventAt,
        new Date('2026-11-23T18:00:00.000Z').getTime(),
      ),
    ).toBe(false);
  });

  it('does not send a late reminder when the schedule is shortened past T-1h', () => {
    // Event moved to 30 minutes from "now"; the 1h-before instant already passed.
    const rescheduledAt = new Date('2026-11-23T16:30:00.000Z');
    const nowMs = new Date('2026-11-23T16:00:00.000Z').getTime();
    expect(isInTripMilestoneReminderWindow(rescheduledAt, nowMs)).toBe(false);
  });

  it('emits load reminder for scheduled trip at T-1h', () => {
    const loadAt = new Date('2026-11-23T17:00:00.000Z');
    const nowMs = new Date('2026-11-23T16:00:30.000Z').getTime();
    const trip = tripFixture({ loadDate: loadAt });
    const due = tripMilestoneRemindersDue(trip, nowMs);
    expect(due.map((d) => d.milestone)).toContain('load');
    expect(due.find((d) => d.milestone === 'load')?.dedupeKey).toBe(
      tripMilestoneReminderDedupeKey(1, 'load', loadAt.toISOString()),
    );
  });

  it('emits the five operative milestones when each is due', () => {
    const at = new Date('2026-11-23T18:00:00.000Z');
    const nowMs = new Date('2026-11-23T17:00:00.000Z').getTime();
    const trip = tripFixture({
      loadDate: at,
      plannedDepartureAt: at,
      plannedArrivalAt: at,
      plannedCompletionAt: at,
      emptyDeliveryAt: at,
      emptyDeliveryPlace: 'Patio',
    });
    const milestones = tripMilestoneRemindersDue(trip, nowMs).map(
      (d) => d.milestone,
    );
    expect(milestones.sort()).toEqual(
      ['arrival', 'completion', 'departure', 'empty_delivery', 'load'].sort(),
    );
  });

  it('uses a new dedupe key when the scheduled time changes', () => {
    const first = new Date('2026-11-23T18:00:00.000Z');
    const second = new Date('2026-11-23T19:30:00.000Z');
    expect(
      tripMilestoneReminderDedupeKey(9, 'arrival', first.toISOString()),
    ).not.toBe(
      tripMilestoneReminderDedupeKey(9, 'arrival', second.toISOString()),
    );
  });

  it('skips cancelled trips', () => {
    const at = new Date('2026-11-23T18:00:00.000Z');
    const nowMs = new Date('2026-11-23T17:00:00.000Z').getTime();
    const trip = tripFixture({
      status: 'cancelled',
      loadDate: at,
      plannedDepartureAt: at,
    });
    expect(tripMilestoneRemindersDue(trip, nowMs)).toEqual([]);
  });

  it('skips completed trips', () => {
    const at = new Date('2026-11-23T18:00:00.000Z');
    const nowMs = new Date('2026-11-23T17:00:00.000Z').getTime();
    const trip = tripFixture({
      status: 'completed',
      plannedArrivalAt: at,
    });
    expect(tripMilestoneRemindersDue(trip, nowMs)).toEqual([]);
  });

  it('requires empty delivery place before reminding', () => {
    const at = new Date('2026-11-23T18:00:00.000Z');
    const nowMs = new Date('2026-11-23T17:00:00.000Z').getTime();
    const withoutPlace = tripFixture({
      emptyDeliveryAt: at,
      emptyDeliveryPlace: '  ',
    });
    expect(
      tripMilestoneRemindersDue(withoutPlace, nowMs).map((d) => d.milestone),
    ).not.toContain('empty_delivery');
  });
});
