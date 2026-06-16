import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Trip } from './trip.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'trip_audit_events' })
export class TripAuditEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'trip_id', type: 'int' })
  tripId: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ name: 'event_type' })
  eventType: string;

  @Column()
  entity: string;

  @Column({ name: 'field_name', nullable: true })
  fieldName?: string;

  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue?: Record<string, unknown>;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue?: Record<string, unknown>;

  @Column({ name: 'reason_code', nullable: true })
  reasonCode?: string;

  @Column({ nullable: true, type: 'text' })
  comment?: string;

  @Column({ name: 'actor_user_id', type: 'int', nullable: true })
  actorUserId?: number;

  @Column({ name: 'actor_display_name', default: 'system' })
  actorDisplayName: string;

  @Column({ default: 'system' })
  source: string;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;
}
