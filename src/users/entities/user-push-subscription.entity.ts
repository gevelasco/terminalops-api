import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { AppUser } from 'src/users/entities/app-user.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'user_push_subscriptions' })
@Unique('uq_user_push_subscriptions_endpoint', ['endpoint'])
@Index('idx_user_push_subscriptions_user_id', ['userId'])
@Index('idx_user_push_subscriptions_company_id', ['companyId'])
export class UserPushSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  /** Endpoint Web Push (identifica el dispositivo / browser). */
  @Column({ type: 'text' })
  endpoint: string;

  @Column({ type: 'text' })
  p256dh: string;

  @Column({ type: 'text' })
  auth: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: AppUser;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: Company;
}
