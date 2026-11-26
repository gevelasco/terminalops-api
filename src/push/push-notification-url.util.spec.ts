import { buildPushNotificationPath } from './push-notification-url.util';

describe('buildPushNotificationPath', () => {
  it('abre maniobra con tracking en recordatorios', () => {
    expect(
      buildPushNotificationPath({
        kind: 'trip.reminder.departure',
        entityType: 'trip',
        entityId: '42',
      }),
    ).toBe('/trips?tripId=42&detailTab=tracking');
  });

  it('abre flota en cobertura', () => {
    expect(
      buildPushNotificationPath({
        kind: 'unit.coverage_updated',
        entityType: 'unit',
        entityId: '7',
      }),
    ).toBe('/fleet?unitId=7&fleetTab=cob');
  });

  it('abre cliente en detalles', () => {
    expect(
      buildPushNotificationPath({
        kind: 'client.updated',
        entityType: 'client',
        entityId: '3',
      }),
    ).toBe('/comercial/clients?clientId=3&clientTab=details');
  });
});
