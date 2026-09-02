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
  const tripsFindOne = jest.fn();
  const tripEquipmentGetOne = jest.fn();

  const tripsRepo = { findOne: tripsFindOne } as unknown as import('typeorm').Repository<Trip>;
  const tripEquipmentRepo = {
    createQueryBuilder: jest.fn(() => ({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: tripEquipmentGetOne,
    })),
  } as unknown as import('typeorm').Repository<TripEquipment>;

  beforeEach(() => {
    jest.clearAllMocks();
    tripsFindOne.mockResolvedValue(null);
    tripEquipmentGetOne.mockResolvedValue(null);
  });

  it('blocks unit already on active trip', async () => {
    tripsFindOne.mockResolvedValue({ id: 99, maneuverCode: 'ADM-0001' });

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

  it('allows unit when only conflict is excluded trip', async () => {
    tripsFindOne.mockResolvedValue(null);

    await expect(
      assertResourceNotOnActiveTrip(
        tripsRepo,
        tripEquipmentRepo,
        1,
        'unit',
        7,
        'Unit',
        10,
      ),
    ).resolves.toBeUndefined();
  });
});
