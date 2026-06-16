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

  @Column({ name: 'operational_center_postal_code', nullable: true, length: 5 })
  operationalCenterPostalCode?: string;

  @Column({ name: 'operational_center_city_municipality', nullable: true })
  operationalCenterCityMunicipality?: string;

  @Column({ name: 'operational_center_locality', nullable: true })
  operationalCenterLocality?: string;

  @Column({ name: 'operational_center_settlement_cons_id', nullable: true, length: 32 })
  operationalCenterSettlementConsId?: string;

  @Column({
    name: 'operational_center_latitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  operationalCenterLatitude?: string;

  @Column({
    name: 'operational_center_longitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  operationalCenterLongitude?: string;

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
