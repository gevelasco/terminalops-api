import { COMPANY_ACTIVITY_KIND } from './company-activity-event.kinds';
import {
  tripActivitySubjectLabel,
  tripPatchActivity,
} from './activity-events.trip.util';

describe('tripActivitySubjectLabel', () => {
  it('prefers the maneuver code', () => {
    expect(tripActivitySubjectLabel('  M-1042 ', 9)).toBe('M-1042');
  });

  it('falls back to the trip id', () => {
    expect(tripActivitySubjectLabel(null, 9)).toBe('M-9');
  });
});

describe('tripPatchActivity', () => {
  it('labels empty-delivery patches as tracking', () => {
    expect(
      tripPatchActivity({
        emptyDeliveryAt: '2026-08-28T18:00:00.000Z',
        emptyDeliveryPlace: 'Patio',
        emptyDeliveryJustification: 'Cambio de patio',
      }),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.TRIP_TRACKING_UPDATED,
      title: 'Seguimiento',
    });
  });

  it('labels other trip patches as maneuver data', () => {
    expect(
      tripPatchActivity({
        loadPlace: 'Puerto',
        loadDate: '2026-08-28T12:00:00.000Z',
      }),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.TRIP_UPDATED,
      title: 'Datos de maniobra',
    });
  });

  it('does not treat a mixed patch as tracking', () => {
    expect(
      tripPatchActivity({
        emptyDeliveryAt: '2026-08-28T18:00:00.000Z',
        loadPlace: 'Puerto',
      }),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.TRIP_UPDATED,
      title: 'Datos de maniobra',
    });
  });
});
