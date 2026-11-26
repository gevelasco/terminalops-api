import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { UserPushSubscription } from './entities/user-push-subscription.entity';

describe('PushSubscriptionsService', () => {
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((row: Partial<UserPushSubscription>) => row),
    save: jest.fn(async (row: UserPushSubscription) => ({
      ...row,
      id: row.id ?? 1,
      createdAt: row.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })),
    delete: jest.fn(async () => undefined),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'VAPID_PUBLIC_KEY') return 'public-test';
      if (key === 'VAPID_PRIVATE_KEY') return 'private-test';
      if (key === 'VAPID_SUBJECT') return 'mailto:test@example.com';
      return undefined;
    }),
  } as unknown as ConfigService;

  const service = new PushSubscriptionsService(repo as never, config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('expone la clave pública VAPID', () => {
    expect(service.getVapidPublicKey()).toEqual({ publicKey: 'public-test' });
  });

  it('crea una suscripción nueva para el usuario', async () => {
    repo.findOne.mockResolvedValue(null);
    const saved = await service.upsertForUser(7, 3, {
      endpoint: 'https://push.example/device-a',
      keys: { p256dh: 'p', auth: 'a' },
      userAgent: 'Chrome',
    });
    expect(saved.endpoint).toBe('https://push.example/device-a');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, companyId: 3 }),
    );
  });

  it('rechaza tomar el endpoint de otro usuario', async () => {
    repo.findOne.mockResolvedValue({
      id: 9,
      userId: 99,
      endpoint: 'https://push.example/device-b',
    });
    await expect(
      service.upsertForUser(7, 3, {
        endpoint: 'https://push.example/device-b',
        keys: { p256dh: 'p', auth: 'a' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('elimina solo el endpoint propio y deja otros intactos', async () => {
    repo.findOne.mockResolvedValue({
      id: 2,
      userId: 7,
      endpoint: 'https://push.example/device-a',
    });
    const result = await service.deleteForUser(7, {
      endpoint: 'https://push.example/device-a',
    });
    expect(result).toEqual({ ok: true, removed: true });
    expect(repo.delete).toHaveBeenCalledWith({ id: 2, userId: 7 });
  });

  it('no permite borrar la suscripción de otro usuario', async () => {
    repo.findOne.mockResolvedValue({
      id: 2,
      userId: 99,
      endpoint: 'https://push.example/device-a',
    });
    await expect(
      service.deleteForUser(7, { endpoint: 'https://push.example/device-a' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
