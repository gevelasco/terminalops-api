import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { OperatorDocument } from './entities/operator-document.entity';
import { OperatorEmergencyContact } from './entities/operator-emergency-contact.entity';
import { OperatorPrivateInsurance } from './entities/operator-private-insurance.entity';
import { OperatorPublicInsurance } from './entities/operator-public-insurance.entity';
import { Operator } from './entities/operator.entity';
import { UpdateOperatorDto } from './dto/update-operator.dto';
import { OperatorsService } from './operators.service';
import { OperatorHrHoldWorkflowService } from './operator-hr-hold-workflow.service';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';

describe('OperatorsService (A6 fleet status lock)', () => {
  let service: OperatorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperatorsService,
        {
          provide: getRepositoryToken(Operator),
          useValue: { findOne: jest.fn(), update: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(OperatorEmergencyContact),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(OperatorPublicInsurance),
          useValue: { findOne: jest.fn(), save: jest.fn(), delete: jest.fn() },
        },
        {
          provide: getRepositoryToken(OperatorPrivateInsurance),
          useValue: { findOne: jest.fn(), save: jest.fn(), delete: jest.fn() },
        },
        {
          provide: getRepositoryToken(OperatorDocument),
          useValue: { delete: jest.fn(), save: jest.fn() },
        },
        { provide: getRepositoryToken(Trip), useValue: { createQueryBuilder: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(Expense), useValue: { createQueryBuilder: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(Unit), useValue: { find: jest.fn() } },
        {
          provide: OperatorHrHoldWorkflowService,
          useValue: { startHold: jest.fn(), endHold: jest.fn() },
        },
        {
          provide: ActivityEventsService,
          useValue: { record: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(OperatorsService);
  });

  it('update rejects status in request body with 400', async () => {
    await expect(
      service.update(1, 2, { status: 'in_use' } as UpdateOperatorDto),
    ).rejects.toThrow(BadRequestException);
  });

  it('create rejects status in request body with 400', async () => {
    await expect(
      service.create(1, { name: 'Juan', status: 'available' } as never),
    ).rejects.toThrow(BadRequestException);
  });
});
