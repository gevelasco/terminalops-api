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

  /**
   * Snapshot de la política al crear/migrar:
   * postal_code | municipality | state
   */
  @Column({
    name: 'destination_scope',
    type: 'varchar',
    length: 32,
    default: 'postal_code',
  })
  destinationScope: string;

  /**
   * Tras bajar de municipio/estado a CP (o estado→municipio): falta completar
   * la llave comercial antes de poder matchear en maniobras.
   */
  @Column({ name: 'route_key_incomplete', type: 'boolean', default: false })
  routeKeyIncomplete: boolean;

  @Column({ name: 'municipality_name', type: 'text', default: '' })
  municipalityName: string;

  @Column({ name: 'state_name', type: 'text', default: '' })
  stateName: string;

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

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  /** Puntos intermedios de ruta personalizada (orden de recorrido). */
  @Column({
    name: 'route_waypoints',
    type: 'jsonb',
    default: () => "'[]'",
  })
  routeWaypoints: Array<{
    label: string;
    lat: number;
    lon: number;
    searchLabel?: string;
  }>;

  /** Casetas en ruta para esta tarifa (lista guardada al persistir). */
  @Column({
    name: 'route_toll_plazas',
    type: 'jsonb',
    default: () => "'[]'",
  })
  routeTollPlazas: Array<{
    order: number;
    plazaKey: string;
    plazaKeySource?: 'catalog' | 'inegi' | 'fallback';
    /** Coordenadas `"lat,lng"` (nombre histórico de campo). */
    inegiPoint?: string;
    name: string;
    section?: string;
    costMxn: number | null;
  }>;

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
