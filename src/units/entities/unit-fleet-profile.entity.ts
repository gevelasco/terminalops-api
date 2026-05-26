import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Unit } from 'src/units/entities/unit.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'unit_fleet_profiles' })
export class UnitFleetProfile {
  @PrimaryColumn({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'trailer_brand_name', nullable: true })
  trailerBrandName?: string;

  @Column({ name: 'trailer_version', nullable: true })
  trailerVersion?: string;

  @Column({ name: 'trailer_color', nullable: true })
  trailerColor?: string;

  @Column({ name: 'trailer_tenure_mode', nullable: true })
  trailerTenureMode?: string;

  @Column({
    name: 'trailer_commercial_value',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  trailerCommercialValue?: string;

  @Column({
    name: 'trailer_recurring_payment_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  trailerRecurringPaymentAmount?: string;

  @Column({ name: 'trailer_recurring_payment_date', type: 'date', nullable: true })
  trailerRecurringPaymentDate?: string;

  @Column({ name: 'trailer_recurring_installment_count', type: 'int', nullable: true })
  trailerRecurringInstallmentCount?: number;

  @Column({
    name: 'trailer_management_owner_payout',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  trailerManagementOwnerPayout?: string;

  @Column({ name: 'transmission_type', nullable: true })
  transmissionType?: string;

  @Column({ name: 'transmission_speeds', nullable: true })
  transmissionSpeeds?: string;

  @Column({ name: 'gross_vehicle_weight_lb', nullable: true })
  grossVehicleWeightLb?: string;

  @Column({ name: 'odometer_km', nullable: true })
  odometerKm?: string;

  @Column({ name: 'last_maintenance_date', type: 'date', nullable: true })
  lastMaintenanceDate?: string;

  @Column({ name: 'last_maintenance_type', nullable: true })
  lastMaintenanceType?: string;

  @Column({
    name: 'last_maintenance_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  lastMaintenanceCost?: string;

  @Column({ name: 'last_maintenance_notes', nullable: true })
  lastMaintenanceNotes?: string;

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

  @Column({ name: 'verification_emissions_date', type: 'date', nullable: true })
  verificationEmissionsDate?: string;

  @Column({
    name: 'verification_emissions_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  verificationEmissionsCost?: string;

  @Column({ name: 'verification_double_articulated_applies', nullable: true })
  verificationDoubleArticulatedApplies?: boolean;

  @Column({ name: 'verification_double_articulated_date', type: 'date', nullable: true })
  verificationDoubleArticulatedDate?: string;

  @Column({
    name: 'verification_double_articulated_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  verificationDoubleArticulatedCost?: string;

  @Column({ name: 'insurance_policy_number', nullable: true })
  insurancePolicyNumber?: string;

  @Column({ name: 'insurance_payment_cadence', nullable: true })
  insurancePaymentCadence?: string;

  @Column({ name: 'insurance_contract_date', type: 'date', nullable: true })
  insuranceContractDate?: string;

  @Column({
    name: 'insurance_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  insuranceCost?: string;

  @Column({ name: 'has_gps', nullable: true })
  hasGps?: boolean;

  @Column({ name: 'gps_provider_brand', nullable: true })
  gpsProviderBrand?: string;

  @Column({
    name: 'gps_price',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  gpsPrice?: string;

  @Column({ name: 'gps_payment_cadence', nullable: true })
  gpsPaymentCadence?: string;

  @Column({ name: 'gps_contract_date', type: 'date', nullable: true })
  gpsContractDate?: string;

  @Column({ name: 'gps_tracking_portal_url', nullable: true })
  gpsTrackingPortalUrl?: string;

  @Column({ name: 'gps_covered_by_insurance_endorsement', nullable: true })
  gpsCoveredByInsuranceEndorsement?: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Unit, (u) => u.fleetProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit;
}
