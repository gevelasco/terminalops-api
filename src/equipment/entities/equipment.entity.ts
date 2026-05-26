import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { Unit } from 'src/units/entities/unit.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'equipment' })
export class Equipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'public_id', type: 'int', unique: true })
  publicId: number;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId?: string;

  @Column()
  name: string;

  @Column({ name: 'serial_number' })
  serialNumber: string;

  @Column({ name: 'last_service_date', type: 'date', nullable: true })
  lastServiceDate?: string;

  @Column({ nullable: true })
  plate?: string;

  @Column({ nullable: true })
  type?: string;

  @Column({ nullable: true })
  status?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Unit, (u) => u.equipment, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unit_id' })
  unit?;

  @OneToOne(() => EquipmentFleetProfile, (p) => p.equipment)
  fleetProfile?;
}
