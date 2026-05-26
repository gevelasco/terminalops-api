import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'expenses' })
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'public_id', type: 'int', unique: true })
  publicId: number;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId?: string;

  @Column()
  category: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ default: 'MXN' })
  currency: string;

  @Column({ name: 'incurred_at', type: 'timestamptz' })
  incurredAt: Date;

  @Column()
  kind: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'related_unit_id', type: 'uuid', nullable: true })
  relatedUnitId?: string;

  @Column({ name: 'related_equipment_id', type: 'uuid', nullable: true })
  relatedEquipmentId?: string;

  @Column({ name: 'related_operator_id', type: 'uuid', nullable: true })
  relatedOperatorId?: string;

  @Column({ name: 'is_operational_provision', default: false })
  isOperationalProvision: boolean;

  @Column({ name: 'invoice_required', default: false })
  invoiceRequired: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Trip, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trip_id' })
  trip?: Trip;

  @ManyToOne(() => Unit, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_unit_id' })
  relatedUnit?: Unit;

  @ManyToOne(() => Equipment, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_equipment_id' })
  relatedEquipment?: Equipment;

  @ManyToOne(() => Operator, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_operator_id' })
  relatedOperator?: Operator;
}
