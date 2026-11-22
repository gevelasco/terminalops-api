import { BadRequestException } from '@nestjs/common';
import {
  assertResourceNotOnActiveTrip,
  isCompletedHistoricalSchedule,
} from './trip-fleet-assignment-guard.util';
import { Trip } from './entities/trip.entity';
import { TripEquipment } from './entities/trip-equipment.entity';

describe('isCompletedHistoricalSchedule', () => {
  it('is true when planned completion is already in the past', () => {
    const now = new Date('2026-09-01T20:00:00.000Z');
    expect(
      isCompletedHistoricalSchedule(new Date('2026-08-31T18:00:00.000Z'), now),
    ).toBe(true);
    expect(
      isCompletedHistoricalSchedule(new Date('2026-09-02T08:00:00.000Z'), now),
    ).toBe(false);
  });
});

describe('assertResourceNotOnActiveTrip', () => {
  const tripsFind = jest.fn();
  const tripEquipmentGetMany = jest.fn();

  const tripsRepo = { find: tripsFind } as unknown as import('typeorm').Repository<Trip>;
  const tripEquipmentRepo = {
    createQueryBuilder: jest.fn(() => ({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: tripEquipmentGetMany,
    })),
  } as unknown as import('typeorm').Repository<TripEquipment>;

  beforeEach(() => {
    jest.clearAllMocks();
    tripsFind.mockResolvedValue([]);
    tripEquipmentGetMany.mockResolvedValue([]);
  });

  it('blocks unit already on active trip without schedule context', async () => {
    tripsFind.mockResolvedValue([
      {
        id: 99,
        maneuverCode: 'ADM-0001',
        plannedDepartureAt: new Date('2026-06-01T08:00:00Z'),
        plannedCompletionAt: new Date('2026-06-02T08:00:00Z'),
      },
    ]);

    await expect(
      assertResourceNotOnActiveTrip(
        tripsRepo,
        tripEquipmentRepo,
        1,
        'unit',
        7,
        'Unit',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows chained schedule when windows do not overlap', async () => {
    tripsFind.mockResolvedValue([
      {
        id: 99,
        maneuverCode: 'ADM-0001',
        plannedDepartureAt: new Date('2026-06-01T08:00:00Z'),
        plannedCompletionAt: new Date('2026-06-02T08:00:00Z'),
      },
    ]);

    await expect(
      assertResourceNotOnActiveTrip(
        tripsRepo,
        tripEquipmentRepo,
        1,
        'unit',
        7,
        'Unit',
        undefined,
        {
          startMs: new Date('2026-06-02T08:00:00Z').getTime(),
          endMs: new Date('2026-06-03T08:00:00Z').getTime(),
        },
      ),
    ).resolves.toBeUndefined();
  });
});
