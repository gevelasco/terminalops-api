jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import { ActivityEventsService } from './activity-events.service';

describe('ActivityEventsService record + push fanout', () => {
  const repo = {
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
    createQueryBuilder: jest.fn(),
  };

  const pushFanout = {
    scheduleForRecordedActivity: jest.fn(),
  };

  const service = new ActivityEventsService(repo as never, pushFanout as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('programa Push solo cuando el insert (sin dedupe) guarda', async () => {
    const inserted = await service.record({
      companyId: 1,
      kind: 'client.created',
      entityType: 'client',
      entityId: 3,
      subjectLabel: 'ACME',
      title: 'Cliente creado',
    });
    expect(inserted).toBe(true);
    expect(pushFanout.scheduleForRecordedActivity).toHaveBeenCalledTimes(1);
  });

  it('no programa Push si dedupe omite el insert', async () => {
    const qb = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      // Conflicto: RETURNING vacío. identifiers/generatedMaps no deben disparar Push.
      execute: jest.fn(async () => ({
        identifiers: [{}],
        generatedMaps: [{}],
        raw: [],
      })),
    };
    repo.createQueryBuilder.mockReturnValue(qb);

    const inserted = await service.record({
      companyId: 1,
      kind: 'trip.reminder.departure',
      entityType: 'trip',
      entityId: 9,
      subjectLabel: 'MX-1',
      title: 'Salida',
      dedupeKey: 'trip:9:reminder:departure',
    });
    expect(inserted).toBe(false);
    expect(pushFanout.scheduleForRecordedActivity).not.toHaveBeenCalled();
  });

  it('programa Push solo si RETURNING trae fila nueva', async () => {
    const qb = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => ({
        identifiers: [{ id: '12' }],
        generatedMaps: [{ id: '12' }],
        raw: [{ id: '12' }],
      })),
    };
    repo.createQueryBuilder.mockReturnValue(qb);

    const inserted = await service.record({
      companyId: 1,
      kind: 'payment.due_today',
      entityType: 'expense',
      entityId: 42,
      subjectLabel: 'Operador',
      title: 'Pago a operador hoy',
      dedupeKey: 'payment-reminder:42:2026-11-27',
    });
    expect(inserted).toBe(true);
    expect(pushFanout.scheduleForRecordedActivity).toHaveBeenCalledTimes(1);
  });

  it('sigue devolviendo true aunque schedule falle', async () => {
    pushFanout.scheduleForRecordedActivity.mockImplementation(() => {
      throw new Error('boom');
    });
    const inserted = await service.record({
      companyId: 1,
      kind: 'expense.manual_created',
      entityType: 'expense',
      entityId: 1,
      subjectLabel: 'Diesel',
      title: 'Gasto',
    });
    expect(inserted).toBe(true);
  });
});
