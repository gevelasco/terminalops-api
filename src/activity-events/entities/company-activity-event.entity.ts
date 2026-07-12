import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'company_activity_events' })
export class CompanyActivityEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ type: 'text' })
  kind: string;

  @Column({ name: 'entity_type', type: 'text' })
  entityType: string;

  @Column({ name: 'entity_id', type: 'text' })
  entityId: string;

  @Column({ name: 'subject_label', type: 'text' })
  subjectLabel: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'actor_user_id', type: 'int', nullable: true })
  actorUserId?: number | null;

  @Column({ name: 'actor_label', type: 'text', default: 'Sistema' })
  actorLabel: string;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ name: 'dedupe_key', type: 'text', nullable: true })
  dedupeKey?: string | null;
}
