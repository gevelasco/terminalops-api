jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import { ActivityPushFanoutService } from './activity-push-fanout.service';
import { WebPushSenderService } from './web-push-sender.service';

describe('ActivityPushFanoutService', () => {
  const sender = {
    isConfigured: jest.fn(() => true),
    sendToSubscriptions: jest.fn(async () => ({
      sent: 2,
      removed: 0,
      failed: 0,
    })),
  } as unknown as WebPushSenderService;

  const subscriptionsRepo = {
    find: jest.fn(),
  };

  const usersRepo = {
    find: jest.fn(),
  };

  const service = new ActivityPushFanoutService(
    sender,
    usersRepo as never,
    subscriptionsRepo as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (sender.isConfigured as jest.Mock).mockReturnValue(true);
  });

  it('no envía si no hay suscripciones', async () => {
    (subscriptionsRepo.find as jest.Mock).mockResolvedValue([]);
    const result = await service.dispatchForRecordedActivity({
      companyId: 1,
      kind: 'trip.updated',
      entityType: 'trip',
      entityId: 9,
      subjectLabel: 'MX-1',
      title: 'Maniobra actualizada',
    });
    expect(result.sent).toBe(0);
    expect(sender.sendToSubscriptions).not.toHaveBeenCalled();
  });

  it('respeta preferencias notificationFeedModules (módulo trips off)', async () => {
    (subscriptionsRepo.find as jest.Mock).mockResolvedValue([
      { id: 1, userId: 10, companyId: 1, endpoint: 'https://a', p256dh: 'p', auth: 'a' },
      { id: 2, userId: 11, companyId: 1, endpoint: 'https://b', p256dh: 'p', auth: 'a' },
    ]);
    (usersRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 10,
        companyId: 1,
        status: 'active',
        role: 'admin',
        username: 'admin',
        preferences: { notificationFeedModules: ['fleet'] },
        moduleAccess: [],
      },
      {
        id: 11,
        companyId: 1,
        status: 'active',
        role: 'admin',
        username: 'ops',
        preferences: { notificationFeedModules: ['trips', 'fleet'] },
        moduleAccess: [],
      },
    ]);

    await service.dispatchForRecordedActivity({
      companyId: 1,
      kind: 'trip.reminder.departure',
      entityType: 'trip',
      entityId: 9,
      subjectLabel: 'MX-1',
      title: 'Salida próxima',
      dedupeKey: 'trip:9:reminder:departure',
    });

    expect(sender.sendToSubscriptions).toHaveBeenCalledTimes(1);
    const targets = (sender.sendToSubscriptions as jest.Mock).mock.calls[0][0];
    expect(targets).toHaveLength(1);
    expect(targets[0].userId).toBe(11);
  });

  it('envía a todos los dispositivos del usuario elegible', async () => {
    (subscriptionsRepo.find as jest.Mock).mockResolvedValue([
      { id: 1, userId: 10, companyId: 1, endpoint: 'https://phone', p256dh: 'p', auth: 'a' },
      { id: 2, userId: 10, companyId: 1, endpoint: 'https://tablet', p256dh: 'p', auth: 'a' },
    ]);
    (usersRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 10,
        companyId: 1,
        status: 'active',
        role: 'admin',
        username: 'admin',
        preferences: { notificationFeedModules: null },
        moduleAccess: [],
      },
    ]);

    await service.dispatchForRecordedActivity({
      companyId: 1,
      kind: 'expense.manual_created',
      entityType: 'expense',
      entityId: 5,
      subjectLabel: 'Diesel',
      title: 'Gasto creado',
    });

    const targets = (sender.sendToSubscriptions as jest.Mock).mock.calls[0][0];
    expect(targets).toHaveLength(2);
  });

  it('no envía a staff sin acceso RBAC al módulo', async () => {
    (subscriptionsRepo.find as jest.Mock).mockResolvedValue([
      { id: 1, userId: 10, companyId: 1, endpoint: 'https://a', p256dh: 'p', auth: 'a' },
    ]);
    (usersRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 10,
        companyId: 1,
        status: 'active',
        role: 'staff',
        username: 'staff',
        preferences: { notificationFeedModules: null },
        moduleAccess: [{ moduleCode: 'fleet', accessLevel: 'read' }],
      },
    ]);

    const result = await service.dispatchForRecordedActivity({
      companyId: 1,
      kind: 'trip.updated',
      entityType: 'trip',
      entityId: 1,
      subjectLabel: 'X',
      title: 'Actualizada',
    });
    expect(result.sent).toBe(0);
    expect(sender.sendToSubscriptions).not.toHaveBeenCalled();
  });
});
