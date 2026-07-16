import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from 'src/clients/entities/client.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { OperationalCenter } from 'src/operational-centers/entities/operational-center.entity';
import { AppUser } from 'src/users/entities/app-user.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'companies' })
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  tagline?: string;

  @Column({ name: 'legal_name', nullable: true })
  legalName?: string;

  @Column({ name: 'subscription_status', default: 'active' })
  subscriptionStatus: string;

  @Column({ name: 'subscription_plan', nullable: true })
  subscriptionPlan?: string;

  @Column({ name: 'subscription_ends_at', type: 'timestamptz', nullable: true })
  subscriptionEndsAt?: Date;

  @Column({ name: 'operational_analysis_enabled', default: true })
  operationalAnalysisEnabled: boolean;

  @Column({
    name: 'operational_analysis_changed_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  operationalAnalysisChangedAt: Date;

  @Column({ name: 'trip_assist_prefill_enabled', default: false })
  tripAssistPrefillEnabled: boolean;

  @Column({
    name: 'trip_assist_prefill_changed_at',
    type: 'timestamptz',
    nullable: true,
  })
  tripAssistPrefillChangedAt?: Date;

  @Column({
    name: 'trip_auto_maintenance_provision_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 5,
  })
  tripAutoMaintenanceProvisionPercent: string;

  @Column({ name: 'trip_auto_fuel_payment_method', default: 'cash' })
  tripAutoFuelPaymentMethod: string;

  @Column({ name: 'trip_auto_tolls_payment_method', default: 'cash' })
  tripAutoTollsPaymentMethod: string;

  @Column({ name: 'trip_auto_per_diem_payment_method', default: 'cash' })
  tripAutoPerDiemPaymentMethod: string;

  @Column({ name: 'trip_auto_control_payment_method', default: 'cash' })
  tripAutoControlPaymentMethod: string;

  @Column({ name: 'maintenance_km_control_enabled', default: false })
  maintenanceKmControlEnabled: boolean;

  @Column({
    name: 'maintenance_km_interval_default',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maintenanceKmIntervalDefault?: string;

  @Column({ name: 'maintenance_date_control_enabled', default: false })
  maintenanceDateControlEnabled: boolean;

  @Column({ name: 'maintenance_date_period_default', nullable: true })
  maintenanceDatePeriodDefault?: string;

  @Column({
    name: 'maintenance_km_control_changed_at',
    type: 'timestamptz',
    nullable: true,
  })
  maintenanceKmControlChangedAt?: Date;

  @Column({
    name: 'maintenance_date_control_changed_at',
    type: 'timestamptz',
    nullable: true,
  })
  maintenanceDateControlChangedAt?: Date;

  @Column({ name: 'diesel_control_enabled', default: true })
  dieselControlEnabled: boolean;

  @Column({
    name: 'diesel_control_changed_at',
    type: 'timestamptz',
    nullable: true,
  })
  dieselControlChangedAt?: Date;

  @Column({
    name: 'diesel_reference_price_per_liter',
    type: 'numeric',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  dieselReferencePricePerLiter?: string;

  @Column({
    name: 'diesel_reference_price_updated_at',
    type: 'timestamptz',
    nullable: true,
  })
  dieselReferencePriceUpdatedAt?: Date;

  @Column({
    name: 'diesel_reference_price_updated_by_user_id',
    type: 'int',
    nullable: true,
  })
  dieselReferencePriceUpdatedByUserId?: number;

  @Column({ name: 'primary_operational_center_id', type: 'int', nullable: true })
  primaryOperationalCenterId?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => AppUser, (u) => u.company)
  users?: AppUser[];

  @OneToMany(() => Client, (c) => c.company)
  clients?: Client[];

  @ManyToOne(() => OperationalCenter, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_operational_center_id' })
  primaryOperationalCenter?: OperationalCenter;
}
