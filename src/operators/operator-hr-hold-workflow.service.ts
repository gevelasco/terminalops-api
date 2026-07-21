import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { assertFleetResourceActive } from 'src/fleet/fleet-resource-active.util';
import { updateFleetResourceStatusCompareAndSet } from 'src/fleet/fleet-status-compare-set.util';
import { TRIP_FLEET_ACTIVE_STATUSES } from 'src/fleet/fleet-status-resolver.util';

export const OPERATOR_HR_HOLD_STATUSES = ['leave', 'incapacitated'] as const;
export type OperatorHrHoldStatus = (typeof OPERATOR_HR_HOLD_STATUSES)[number];

@Injectable()
export class OperatorHrHoldWorkflowService {
  constructor(
    @InjectRepository(Operator)
    private readonly operatorsRepo: Repository<Operator>,
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
  ) {}

  async startHold(
    companyId: number,
    operatorId: number,
    hold: OperatorHrHoldStatus,
  ): Promise<void> {
    const operator = await this.operatorsRepo.findOne({
      where: { id: operatorId, companyId },
      select: ['id', 'status', 'isActive'],
    });
    if (!operator) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }
    assertFleetResourceActive(operator.isActive, 'Operator');
    if ((operator.status ?? '').trim().toLowerCase() !== 'available') {
      throw new BadRequestException(
        'El operador debe estar disponible (sin maniobra activa) para marcar vacaciones o incapacidad.',
      );
    }
    await this.assertNotOnActiveTrip(companyId, operatorId);
    await this.setStatus(companyId, operatorId, operator.status, hold);
  }

  async endHold(companyId: number, operatorId: number): Promise<void> {
    const operator = await this.operatorsRepo.findOne({
      where: { id: operatorId, companyId },
      select: ['id', 'status', 'isActive'],
    });
    if (!operator) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }
    const current = (operator.status ?? '').trim().toLowerCase();
    if (!OPERATOR_HR_HOLD_STATUSES.includes(current as OperatorHrHoldStatus)) {
      throw new BadRequestException(
        'Solo operadores en vacaciones o incapacidad pueden reincorporarse a disponible.',
      );
    }
    await this.setStatus(companyId, operatorId, operator.status, 'available');
  }

  private async assertNotOnActiveTrip(
    companyId: number,
    operatorId: number,
  ): Promise<void> {
    const active = await this.tripsRepo.findOne({
      where: {
        companyId,
        operatorId,
        deletedAt: IsNull(),
        status: In([...TRIP_FLEET_ACTIVE_STATUSES]),
      },
      select: ['id'],
    });
    if (active) {
      throw new BadRequestException(
        'El operador está asignado a una maniobra activa. Finaliza o reasigna la maniobra antes de marcar vacaciones o incapacidad.',
      );
    }
  }

  private async setStatus(
    companyId: number,
    operatorId: number,
    expectedStatus: string,
    nextStatus: string,
  ): Promise<void> {
    const updated = await updateFleetResourceStatusCompareAndSet(
      this.operatorsRepo,
      companyId,
      operatorId,
      expectedStatus,
      nextStatus,
    );
    if (!updated) {
      throw new BadRequestException(
        'El estado del operador cambió; vuelve a intentar.',
      );
    }
  }
}
