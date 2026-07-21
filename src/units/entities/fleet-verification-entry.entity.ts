import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Unit } from 'src/units/entities/unit.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';

export type FleetVerificationScope =
  | 'phys_mech'
  | 'emissions'
  | 'double_articulated';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'fleet_verification_entries' })
export class FleetVerificationEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'unit_id', type: 'int', nullable: true })
  unitId?: number;

  @Column({ name: 'equipment_id', type: 'int', nullable: true })
  equipmentId?: number;

  @Column({ type: 'text' })
  scope: FleetVerificationScope;

  @Column({ name: 'entry_date', type: 'date', nullable: true })
  entryDate?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  cost?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'payment_method', type: 'text', nullable: true })
  paymentMethod?: string;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Unit, (u) => u.verificationEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @ManyToOne(() => Equipment, (e) => e.verificationEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment?: Equipment;
}
