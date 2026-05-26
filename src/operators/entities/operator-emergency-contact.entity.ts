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

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'operator_emergency_contacts' })
export class OperatorEmergencyContact {
  @PrimaryColumn({ name: 'operator_id', type: 'uuid' })
  operatorId: string;

  @Column({ default: '' })
  name: string;

  @Column({ default: '' })
  relationship: string;

  @Column({ default: '' })
  phone: string;

  @Column({ default: '' })
  email: string;

  @Column({ name: 'authorized_medical_info', default: false })
  authorizedMedicalInfo: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Operator, (o) => o.emergencyContact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operator_id' })
  operator: Operator;
}
