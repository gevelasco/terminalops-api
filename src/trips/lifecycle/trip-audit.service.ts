import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripAuditEvent } from '../entities/trip-audit-event.entity';
import { LIFECYCLE_ENGINE_REASON } from './trip-lifecycle.types';

export interface RecordLifecycleStatusChangeParams {
  tripId: number;
  companyId: number;
  fromStatus: string;
  toStatus: string;
  occurredAt?: Date;
}

@Injectable()
export class TripAuditService {
  constructor(
    @InjectRepository(TripAuditEvent)
    private readonly auditRepo: Repository<TripAuditEvent>,
  ) {}

  async recordLifecycleStatusChange(
    params: RecordLifecycleStatusChangeParams,
  ): Promise<void> {
    await this.auditRepo.save(
      this.auditRepo.create({
        tripId: params.tripId,
        companyId: params.companyId,
        eventType: 'lifecycle.status.changed',
        entity: 'lifecycle',
        fieldName: 'status',
        oldValue: { status: params.fromStatus },
        newValue: { status: params.toStatus },
        reasonCode: LIFECYCLE_ENGINE_REASON,
        comment: 'Transición automática del motor de lifecycle',
        actorDisplayName: 'system',
        source: 'system',
        occurredAt: params.occurredAt ?? new Date(),
      }),
    );
  }
}
