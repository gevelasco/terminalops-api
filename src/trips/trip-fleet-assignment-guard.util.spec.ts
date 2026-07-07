import { BadRequestException } from '@nestjs/common';
import { assertResourceNotOnActiveTrip } from './trip-fleet-assignment-guard.util';
import { Trip } from './entities/trip.entity';
import { TripEquipment } from './entities/trip-equipment.entity';

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
