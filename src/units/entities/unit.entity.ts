import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { UnitFleetDocument } from 'src/units/entities/unit-fleet-document.entity';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'units' })
export class Unit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column()
  plate: string;

  @Column({ name: 'capacity_kg', type: 'int' })
  capacityKg: number;

  @Column()
  status: string;

  @Column({ name: 'serial_number', nullable: true })
  serialNumber?: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ name: 'trailer_brand_abbr', nullable: true })
  trailerBrandAbbr?: string;

  @Column({ name: 'trailer_year', nullable: true })
  trailerYear?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => UnitFleetProfile, (p) => p.unit)
  fleetProfile?;

  @OneToMany(() => FleetMaintenanceEntry, (e) => e.unit)
  maintenanceEntries?: FleetMaintenanceEntry[];

  @OneToMany(() => UnitFleetDocument, (d) => d.unit)
  fleetDocuments?: UnitFleetDocument[];

  @OneToMany(() => Equipment, (e) => e.unit)
  equipment?;
}
