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
import { DestinationRate } from 'src/destination-rates/entities/destination-rate.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Unit } from 'src/units/entities/unit.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'trips' })
export class Trip {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ name: 'maneuver_code' })
  maneuverCode: string;

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

  @Column({ name: 'operation_type' })
  operationType: string;

  @Column({ name: 'operation_configuration_id', type: 'int', nullable: true })
  operationConfigurationId?: number;

  @Column({ name: 'load_type' })
  loadType: string;

  @Column({ name: 'container_type' })
  containerType: string;

  @Column({ name: 'cargo_description', nullable: true })
  cargoDescription?: string;

  @Column({ name: 'approximate_weight_tons', nullable: true })
  approximateWeightTons?: string;

  /** Fecha y hora de carga. */
  @Column({ name: 'load_date', type: 'timestamptz', nullable: true })
  loadDate?: Date;

  /** Lugar de carga (texto libre; alimenta catálogo por empresa). */
  @Column({ name: 'load_place', nullable: true })
  loadPlace?: string;

  /** Entrega de vacío: fecha/hora (nunca antes del fin planeado o real). */
  @Column({ name: 'empty_delivery_at', type: 'timestamptz', nullable: true })
  emptyDeliveryAt?: Date;

  /** Entrega de vacío: lugar (mismo catálogo de lugares por empresa). */
  @Column({ name: 'empty_delivery_place', nullable: true })
  emptyDeliveryPlace?: string;

  @Column({ name: 'departure_at', type: 'timestamptz', nullable: true })
  departureAt?: Date;

  @Column({ name: 'arrived_at', type: 'timestamptz', nullable: true })
  arrivedAt?: Date;

  @Column({ name: 'return_at', type: 'timestamptz', nullable: true })
  returnAt?: Date;

  @Column({ name: 'planned_departure_at', type: 'timestamptz' })
  plannedDepartureAt: Date;

  @Column({ name: 'planned_arrival_at', type: 'timestamptz' })
  plannedArrivalAt: Date;

  @Column({ name: 'planned_completion_at', type: 'timestamptz' })
  plannedCompletionAt: Date;

  @Column({ name: 'status_changed_at', type: 'timestamptz', nullable: true })
  statusChangedAt?: Date;

  @Column({ name: 'status_changed_by', nullable: true })
  statusChangedBy?: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'credit_days', type: 'int', default: 0 })
  creditDays: number;

  @Column({ name: 'has_incident', default: false })
  hasIncident: boolean;

  @Column({ name: 'route_distance_km', type: 'numeric', precision: 10, scale: 2, nullable: true })
  routeDistanceKm?: string;

  /** Km operativos ya sumados al odómetro de la unidad (idempotencia / reversión). */
  @Column({
    name: 'unit_odometer_km_credited',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  unitOdometerKmCredited?: string | null;

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

  @Column({ name: 'destination_rate_id', type: 'int', nullable: true })
  destinationRateId?: number;

  @Column({ name: 'diesel_liters', type: 'numeric', precision: 12, scale: 3, nullable: true })
  dieselLiters?: string;

  @Column({ name: 'diesel_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  dieselAmount?: string;

  @Column({ name: 'casetas_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  casetasAmount?: string;

  @Column({ name: 'operator_quota', type: 'numeric', precision: 14, scale: 2, nullable: true })
  operatorQuota?: string;

  @Column({ name: 'per_diem_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  perDiemAmount?: string;

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

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @Column({ name: 'deleted_by', type: 'text', nullable: true })
  deletedBy?: string | null;

  @ManyToOne(() => Client, (client) => client.trips, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client?: Client;

  @ManyToOne(() => Unit, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @ManyToOne(() => Operator, (operator) => operator.trips, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operator_id' })
  operator?: Operator;

  @ManyToOne(() => DestinationRate, (rate) => rate.trips, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'destination_rate_id' })
  destinationRate?: DestinationRate;

  @OneToMany(() => TripEquipment, (te) => te.trip)
  tripEquipment?: TripEquipment[];

  @OneToMany(() => TripIncident, (i) => i.trip)
  incidents?: TripIncident[];
}
