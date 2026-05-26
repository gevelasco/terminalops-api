import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Equipment } from 'src/equipment/entities/equipment.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'equipment_fleet_profiles' })
export class EquipmentFleetProfile {
  @PrimaryColumn({ name: 'equipment_id', type: 'uuid' })
  equipmentId: string;

  @Column({ name: 'equipment_capacity_tons', nullable: true })
  equipmentCapacityTons?: string;

  @Column({ name: 'equipment_axle_count', type: 'int', nullable: true })
  equipmentAxleCount?: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Equipment, (e) => e.fleetProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment;
}
