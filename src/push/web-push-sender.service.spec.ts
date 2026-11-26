import { ConfigService } from '@nestjs/config';

const sendNotification = jest.fn();
const setVapidDetails = jest.fn();

jest.mock('web-push', () => ({
  setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
  sendNotification: (...args: unknown[]) => sendNotification(...args),
}));

import { WebPushSenderService } from './web-push-sender.service';

describe('WebPushSenderService', () => {
  const subscriptions = {
    delete: jest.fn(async () => undefined),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'VAPID_PUBLIC_KEY') return 'pub';
      if (key === 'VAPID_PRIVATE_KEY') return 'priv';
      if (key === 'VAPID_SUBJECT') return 'mailto:test@example.com';
      return undefined;
    }),
  } as unknown as ConfigService;

  const service = new WebPushSenderService(config, subscriptions as never);

  beforeEach(() => {
    jest.clearAllMocks();
    service.onModuleInit();
  });

  it('elimina suscripciones 410/404 y no rompe el lote', async () => {
    sendNotification
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));

    const result = await service.sendToSubscriptions(
      [
        { id: 1, userId: 1, endpoint: 'https://ok', p256dh: 'p', auth: 'a' },
        { id: 2, userId: 1, endpoint: 'https://gone', p256dh: 'p', auth: 'a' },
        { id: 3, userId: 2, endpoint: 'https://fail', p256dh: 'p', auth: 'a' },
      ] as never,
      {
        title: 'TerminalOps',
        body: 'Hola',
        url: '/trips?tripId=1',
        kind: 'trip.updated',
        entityType: 'trip',
        entityId: '1',
      },
    );

    expect(result).toEqual({ sent: 1, removed: 1, failed: 1 });
    expect(subscriptions.delete).toHaveBeenCalled();
  });
});
