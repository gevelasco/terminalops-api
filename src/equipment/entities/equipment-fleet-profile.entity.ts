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

  @Column({ name: 'last_maintenance_date', type: 'date', nullable: true })
  lastMaintenanceDate?: string | null;

  @Column({ name: 'last_maintenance_type', type: 'text', nullable: true })
  lastMaintenanceType?: string | null;

  @Column({
    name: 'last_maintenance_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  lastMaintenanceCost?: string | null;

  @Column({ name: 'last_maintenance_notes', type: 'text', nullable: true })
  lastMaintenanceNotes?: string | null;

  @Column({ name: 'tire_condition', nullable: true })
  tireCondition?: string;

  @Column({ name: 'maintenance_alert_by_km', nullable: true })
  maintenanceAlertByKm?: boolean;

  @Column({ name: 'maintenance_next_date_override', type: 'date', nullable: true })
  maintenanceNextDateOverride?: string;

  @Column({
    name: 'maintenance_km_interval',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maintenanceKmInterval?: string;

  @Column({
    name: 'maintenance_trip_km_at_last_service',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  maintenanceTripKmAtLastService?: string;

  @Column({
    name: 'maintenance_km_remaining',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  maintenanceKmRemaining?: string;

  @Column({ name: 'verification_phys_mech_date', type: 'date', nullable: true })
  verificationPhysMechDate?: string;

  @Column({
    name: 'verification_phys_mech_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  verificationPhysMechCost?: string;

  @Column({ name: 'equipment_operated_by_agency', nullable: true })
  equipmentOperatedByAgency?: boolean;

  @Column({ name: 'phys_mech_two_year_exempt_start_date', type: 'date', nullable: true })
  physMechTwoYearExemptStartDate?: string;

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
