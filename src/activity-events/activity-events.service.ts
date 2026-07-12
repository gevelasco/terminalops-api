import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyActivityEvent } from './entities/company-activity-event.entity';
import { activityActorFromUser } from './activity-events.actor.util';
import type AuthUser from 'src/types/auth-user.type';

export interface RecordCompanyActivityParams {
  companyId: number;
  kind: string;
  entityType: string;
  entityId: string | number;
  subjectLabel: string;
  title: string;
  actor?: AuthUser | null;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
}

@Injectable()
export class ActivityEventsService {
  constructor(
    @InjectRepository(CompanyActivityEvent)
    private readonly repo: Repository<CompanyActivityEvent>,
  ) {}

  async record(params: RecordCompanyActivityParams): Promise<void> {
    const actor = activityActorFromUser(params.actor);
    const row = this.repo.create({
      companyId: params.companyId,
      kind: params.kind,
      entityType: params.entityType,
      entityId: String(params.entityId),
      subjectLabel: params.subjectLabel.trim() || '—',
      title: params.title.trim(),
      actorUserId: actor.actorUserId,
      actorLabel: actor.actorLabel,
      occurredAt: params.occurredAt ?? new Date(),
      metadata: params.metadata ?? null,
      dedupeKey: params.dedupeKey?.trim() || null,
    });

    if (row.dedupeKey) {
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(CompanyActivityEvent)
        .values({
          companyId: row.companyId,
          kind: row.kind,
          entityType: row.entityType,
          entityId: row.entityId,
          subjectLabel: row.subjectLabel,
          title: row.title,
          actorUserId: row.actorUserId,
          actorLabel: row.actorLabel,
          occurredAt: row.occurredAt,
          metadata: row.metadata ?? null,
          dedupeKey: row.dedupeKey,
        } as never)
        .orIgnore()
        .execute();
      return;
    }

    await this.repo.save(row);
  }

  async listForCompany(
    companyId: number,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<CompanyActivityEvent[]> {
    return this.repo
      .createQueryBuilder('event')
      .where('event.companyId = :companyId', { companyId })
      .andWhere('event.occurredAt >= :from', { from })
      .andWhere('event.occurredAt <= :to', { to })
      .orderBy('event.occurredAt', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .take(limit)
      .getMany();
  }
}
