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
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { OperationalCenter } from 'src/operational-centers/entities/operational-center.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { DestinationRatePrice } from './destination-rate-price.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'destination_rates' })
export class DestinationRate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ name: 'origin_operational_center_id', type: 'int' })
  originOperationalCenterId: number;

  @Column({ name: 'origin_postal_code', type: 'varchar', length: 5, default: '' })
  originPostalCode: string;

  @Column({ name: 'origin_city_municipality', type: 'text', default: '' })
  originCityMunicipality: string;

  @Column({ name: 'origin_locality', type: 'text', default: '' })
  originLocality: string;

  @Column({
    name: 'origin_latitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  originLatitude?: string;

  @Column({
    name: 'origin_longitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  originLongitude?: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 5 })
  postalCode: string;

  @Column({ name: 'city_municipality', type: 'text', default: '' })
  cityMunicipality: string;

  @Column({ type: 'text', default: '' })
  locality: string;

  @Column({
    name: 'destination_latitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  destinationLatitude?: string;

  @Column({
    name: 'destination_longitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  destinationLongitude?: string;

  @Column({
    name: 'route_distance_km',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
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

  @Column({ name: 'distance_calculated_at', type: 'timestamptz', nullable: true })
  distanceCalculatedAt?: Date;

  /** Referencia UX: tiempo estimado salida → llegada cliente (no operativo). */
  @Column({
    name: 'estimated_arrival_time_value',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  estimatedArrivalTimeValue?: string;

  /** Referencia UX: tiempo estimado llegada cliente → regreso (no operativo). */
  @Column({
    name: 'estimated_return_time_value',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  estimatedReturnTimeValue?: string;

  @Column({
    name: 'estimated_time_unit',
    type: 'varchar',
    length: 5,
    nullable: true,
  })
  estimatedTimeUnit?: 'hours' | 'days';

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => OperationalCenter, (center) => center.destinationRates, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'origin_operational_center_id' })
  originOperationalCenter?: OperationalCenter;

  @OneToMany(() => DestinationRatePrice, (price) => price.destinationRate, {
    cascade: true,
  })
  prices?: DestinationRatePrice[];

  @OneToMany(() => Trip, (trip) => trip.destinationRate)
  trips?: Trip[];

  /** Conteo de maniobras (solo en listados; no es columna persistida). */
  maneuverCount?: number;
}
