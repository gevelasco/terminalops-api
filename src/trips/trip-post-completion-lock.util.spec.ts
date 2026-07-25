import {
  TRIP_POST_COMPLETION_EDIT_DAYS,
  isTripFollowUpLocked,
} from './trip-post-completion-lock.util';

describe('isTripFollowUpLocked', () => {
  const completedAt = new Date('2026-07-01T12:00:00.000Z');
  const completedMs = completedAt.getTime();

  it('keeps completed trips editable inside the window', () => {
    expect(
      isTripFollowUpLocked(
        { status: 'completed', completedAt },
        completedMs + (TRIP_POST_COMPLETION_EDIT_DAYS - 1) * 24 * 60 * 60 * 1000,
      ),
    ).toBe(false);
  });

  it('locks completed trips after 7 days', () => {
    expect(
      isTripFollowUpLocked(
        { status: 'completed', completedAt },
        completedMs + TRIP_POST_COMPLETION_EDIT_DAYS * 24 * 60 * 60 * 1000 + 1,
      ),
    ).toBe(true);
  });
});
