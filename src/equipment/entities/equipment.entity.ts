import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { FleetVerificationEntry } from 'src/units/entities/fleet-verification-entry.entity';
import { EquipmentFleetDocument } from 'src/equipment/entities/equipment-fleet-document.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'equipment' })
export class Equipment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ name: 'unit_id', type: 'int', nullable: true })
  unitId?: number;

  /** `lead` = delantero (pegado al tracto); `rear` = trasero en convoy full. */
  @Column({ name: 'hitch_position', type: 'text', nullable: true })
  hitchPosition?: 'lead' | 'rear' | null;

  @Column()
  name: string;

  @Column({ name: 'serial_number' })
  serialNumber: string;

  @Column({ nullable: true })
  plate?: string;

  @Column({ nullable: true })
  type?: string;

  @Column({ nullable: true })
  status?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'trailer_brand_abbr', nullable: true })
  trailerBrandAbbr?: string;

  @Column({ name: 'trailer_year', nullable: true })
  trailerYear?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Unit, (u) => u.equipment, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unit_id' })
  unit?;

  @OneToOne(() => EquipmentFleetProfile, (p) => p.equipment)
  fleetProfile?;

  @OneToMany(() => FleetMaintenanceEntry, (e) => e.equipment)
  maintenanceEntries?: FleetMaintenanceEntry[];

  @OneToMany(() => FleetVerificationEntry, (e) => e.equipment)
  verificationEntries?: FleetVerificationEntry[];

  @OneToMany(() => EquipmentFleetDocument, (d) => d.equipment)
  fleetDocuments?: EquipmentFleetDocument[];
}
