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
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { Unit } from 'src/units/entities/unit.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'trips' })
export class Trip {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ name: 'maneuver_code' })
  maneuverCode: string;

  @Column()
  origin: string;

  @Column()
  destination: string;

  @Column({ name: 'client_id', type: 'int', nullable: true })
  clientId?: number;

  @Column({ name: 'client_name' })
  clientName: string;

  @Column({ name: 'unit_id', type: 'int', nullable: true })
  unitId?: number;

  @Column({ name: 'operator_id', type: 'int', nullable: true })
  operatorId?: number;

  @Column()
  status: string;

  @Column({ name: 'programmed_at', type: 'timestamptz' })
  programmedAt: Date;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ name: 'operation_type' })
  operationType: string;

  @Column({ name: 'operation_configuration_id', type: 'int', nullable: true })
  operationConfigurationId?: number;

  @Column({ name: 'operation_configuration_name_snapshot', type: 'text', default: '' })
  operationConfigurationNameSnapshot: string;

  @Column({
    name: 'operation_configuration_version_snapshot',
    type: 'int',
    default: 1,
  })
  operationConfigurationVersionSnapshot: number;

  @Column({
    name: 'operation_configuration_max_equipment_count_snapshot',
    type: 'smallint',
    default: 1,
  })
  operationConfigurationMaxEquipmentCountSnapshot: number;

  @Column({ name: 'load_type' })
  loadType: string;

  @Column({ name: 'container_type' })
  containerType: string;

  @Column({ name: 'cargo_description', nullable: true })
  cargoDescription?: string;

  @Column({ name: 'approximate_weight_tons', nullable: true })
  approximateWeightTons?: string;

  @Column({ name: 'departure_at', type: 'timestamptz', nullable: true })
  departureAt?: Date;

  @Column({ name: 'arrived_at', type: 'timestamptz', nullable: true })
  arrivedAt?: Date;

  @Column({ name: 'return_at', type: 'timestamptz', nullable: true })
  returnAt?: Date;

  @Column({ name: 'credit_days', type: 'int', default: 0 })
  creditDays: number;

  @Column({ name: 'has_incident', default: false })
  hasIncident: boolean;

  @Column({ name: 'route_distance_km', type: 'numeric', precision: 10, scale: 2, nullable: true })
  routeDistanceKm?: string;

  @Column({
    name: 'operational_distance_km',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  operationalDistanceKm?: string;

  @Column({ name: 'is_round_trip', default: true })
  isRoundTrip: boolean;

  @Column({ name: 'maneuver_kind', nullable: true })
  maneuverKind?: string;

  @Column({ name: 'origin_postal_code', nullable: true })
  originPostalCode?: string;

  @Column({ name: 'origin_city_municipality', nullable: true })
  originCityMunicipality?: string;

  @Column({ name: 'origin_locality', nullable: true })
  originLocality?: string;

  @Column({ name: 'destination_postal_code', nullable: true })
  destinationPostalCode?: string;

  @Column({ name: 'destination_city_municipality', nullable: true })
  destinationCityMunicipality?: string;

  @Column({ name: 'destination_locality', nullable: true })
  destinationLocality?: string;

  @Column({ name: 'operator_license_number', nullable: true })
  operatorLicenseNumber?: string;

  @Column({ name: 'operator_license_expires_label', nullable: true })
  operatorLicenseExpiresLabel?: string;

  @Column({ name: 'operator_name_snapshot', nullable: true })
  operatorNameSnapshot?: string;

  @Column({ name: 'unit_operational_code_snapshot', nullable: true })
  unitOperationalCodeSnapshot?: string;

  @Column({ name: 'diesel_liters', type: 'numeric', precision: 12, scale: 3, nullable: true })
  dieselLiters?: string;

  @Column({ name: 'diesel_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  dieselAmount?: string;

  /** Precio diesel MXN/L al crear la maniobra (inmutable en updates). */
  @Column({
    name: 'diesel_price_per_liter_at_creation',
    type: 'numeric',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  dieselPricePerLiterAtCreation?: string;

  @Column({ name: 'casetas_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  casetasAmount?: string;

  @Column({ name: 'toll_route_id', type: 'int', nullable: true })
  tollRouteId?: number;

  @Column({ name: 'toll_calculation_mode', nullable: true })
  tollCalculationMode?: string;

  /** Casetas solo ida al crear (snapshot inmutable). */
  @Column({ name: 'route_toll_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  routeTollAmount?: string;

  @Column({ name: 'operator_quota', type: 'numeric', precision: 14, scale: 2, nullable: true })
  operatorQuota?: string;

  @Column({ name: 'client_charge', type: 'numeric', precision: 14, scale: 2, nullable: true })
  clientCharge?: string;

  @Column({ name: 'payment_method', nullable: true })
  paymentMethod?: string;

  @Column({ name: 'requires_invoice', nullable: true })
  requiresInvoice?: boolean;

  @Column({ name: 'has_client_billing', nullable: true })
  hasClientBilling?: boolean;

  @Column({ name: 'false_maneuver', nullable: true })
  falseManeuver?: boolean;

  @Column({ name: 'cancellation_note', nullable: true })
  cancellationNote?: string;

  @Column({ name: 'client_collected_at', type: 'timestamptz', nullable: true })
  clientCollectedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Client, (client) => client.trips, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client?: Client;

  @ManyToOne(() => Unit, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @ManyToOne(() => Operator, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operator_id' })
  operator?: Operator;

  @OneToMany(() => TripEquipment, (te) => te.trip)
  tripEquipment?: TripEquipment[];

  @OneToMany(() => TripIncident, (i) => i.trip)
  incidents?: TripIncident[];
}
