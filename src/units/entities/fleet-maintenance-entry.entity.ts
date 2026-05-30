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

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'fleet_maintenance_entries' })
export class FleetMaintenanceEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'unit_id', type: 'int', nullable: true })
  unitId?: number;

  @Column({ name: 'equipment_id', type: 'int', nullable: true })
  equipmentId?: number;

  @Column({ name: 'entry_date', type: 'date', nullable: true })
  entryDate?: string;

  @Column({ name: 'entry_type', nullable: true })
  entryType?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  cost?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ nullable: true })
  status?: string;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Unit, (u) => u.maintenanceEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @ManyToOne(() => Equipment, (e) => e.maintenanceEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment?: Equipment;
}
