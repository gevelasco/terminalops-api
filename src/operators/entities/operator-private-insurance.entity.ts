import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Operator } from 'src/operators/entities/operator.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'operator_private_insurance' })
export class OperatorPrivateInsurance {
  @PrimaryColumn({ name: 'operator_id', type: 'uuid' })
  operatorId: string;

  @Column({ default: '' })
  carrier: string;

  @Column({ name: 'policy_number', default: '' })
  policyNumber: string;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom?: string;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo?: string;

  @Column({ name: 'premium_amount', default: '' })
  premiumAmount: string;

  @Column({ name: 'premium_period', default: '' })
  premiumPeriod: string;

  @Column({ name: 'deductible_notes', default: '' })
  deductibleNotes: string;

  @Column({ name: 'plan_summary', default: '' })
  planSummary: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Operator, (o) => o.privateInsurance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operator_id' })
  operator: Operator;
}
