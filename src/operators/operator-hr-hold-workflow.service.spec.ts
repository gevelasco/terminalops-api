import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Operator } from './entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { OperatorHrHoldWorkflowService } from './operator-hr-hold-workflow.service';
import * as compareSet from 'src/fleet/fleet-status-compare-set.util';

describe('OperatorHrHoldWorkflowService', () => {
  let service: OperatorHrHoldWorkflowService;
  const findOne = jest.fn();
  const tripFindOne = jest.fn();

  beforeEach(async () => {
    findOne.mockReset();
    tripFindOne.mockReset();
    jest.spyOn(compareSet, 'updateFleetResourceStatusCompareAndSet').mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperatorHrHoldWorkflowService,
        {
          provide: getRepositoryToken(Operator),
          useValue: { findOne },
        },
        {
          provide: getRepositoryToken(Trip),
          useValue: { findOne: tripFindOne },
        },
      ],
    }).compile();

    service = module.get(OperatorHrHoldWorkflowService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts leave from available when no active trip', async () => {
    findOne.mockResolvedValue({ id: 2, status: 'available', isActive: true });
    tripFindOne.mockResolvedValue(null);
    await service.startHold(1, 2, 'leave');
    expect(compareSet.updateFleetResourceStatusCompareAndSet).toHaveBeenCalledWith(
      expect.anything(),
      1,
      2,
      'available',
      'leave',
    );
  });

  it('rejects leave when not available', async () => {
    findOne.mockResolvedValue({ id: 2, status: 'in_use', isActive: true });
    await expect(service.startHold(1, 2, 'leave')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('ends hold back to available', async () => {
    findOne.mockResolvedValue({ id: 2, status: 'incapacitated', isActive: true });
    await service.endHold(1, 2);
    expect(compareSet.updateFleetResourceStatusCompareAndSet).toHaveBeenCalledWith(
      expect.anything(),
      1,
      2,
      'incapacitated',
      'available',
    );
  });

  it('throws when operator missing', async () => {
    findOne.mockResolvedValue(null);
    await expect(service.startHold(1, 9, 'leave')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
