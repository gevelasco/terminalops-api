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
  @PrimaryColumn({ name: 'equipment_id', type: 'int' })
  equipmentId: number;

  @Column({ name: 'trailer_brand_name', nullable: true })
  trailerBrandName?: string;

  @Column({ name: 'trailer_version', nullable: true })
  trailerVersion?: string;

  @Column({ name: 'trailer_color', nullable: true })
  trailerColor?: string;

  @Column({ name: 'equipment_capacity_tons', nullable: true })
  equipmentCapacityTons?: string;

  @Column({ name: 'equipment_axle_count', type: 'int', nullable: true })
  equipmentAxleCount?: number;

  @Column({ name: 'equipment_container_slot_config', nullable: true })
  equipmentContainerSlotConfig?: string;

  @Column({ name: 'equipment_tire_count', type: 'int', nullable: true })
  equipmentTireCount?: number;

  @Column({ name: 'tire_condition', nullable: true })
  tireCondition?: string;

  @Column({ name: 'insurance_policy_number', nullable: true })
  insurancePolicyNumber?: string;

  @Column({ name: 'insurance_carrier_name', nullable: true })
  insuranceCarrierName?: string;

  @Column({ name: 'insurance_payment_cadence', nullable: true })
  insurancePaymentCadence?: string;

  @Column({ name: 'insurance_contract_date', type: 'date', nullable: true })
  insuranceContractDate?: string;

  @Column({ name: 'insurance_last_payment_date', type: 'date', nullable: true })
  insuranceLastPaymentDate?: string | null;

  @Column({
    name: 'insurance_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  insuranceCost?: string;

  @Column({ name: 'insurance_payment_method', type: 'text', nullable: true })
  insurancePaymentMethod?: string | null;

  @Column({ name: 'insurance_invoice_required', default: false })
  insuranceInvoiceRequired: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Equipment, (e) => e.fleetProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment;
}
