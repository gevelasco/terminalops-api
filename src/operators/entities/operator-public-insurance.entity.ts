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

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'operator_public_insurance' })
export class OperatorPublicInsurance {
  @PrimaryColumn({ name: 'operator_id', type: 'int' })
  operatorId: number;

  @Column({ default: '' })
  nss: string;

  @Column({ name: 'imss_alta_date', type: 'date', nullable: true })
  imssAltaDate?: string;

  @Column({ default: false })
  infonavit: boolean;

  @Column({ name: 'infonavit_credit_number', default: '' })
  infonavitCreditNumber: string;

  @Column({ default: false })
  fonacot: boolean;

  @Column({ name: 'fonacot_credit_number', default: '' })
  fonacotCreditNumber: string;

  @Column({ default: '' })
  notes: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Operator, (o) => o.publicInsurance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operator_id' })
  operator: Operator;
}
