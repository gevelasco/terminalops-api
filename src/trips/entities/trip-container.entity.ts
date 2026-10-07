import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Trip } from 'src/trips/entities/trip.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'trip_containers' })
export class TripContainer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'trip_id', type: 'int' })
  tripId: number;

  /** Posición en el convoy (1 = primero, 2 = segundo en doble articulado). */
  @Column({ type: 'smallint' })
  slot: number;

  @Column({ name: 'container_type' })
  containerType: string;

  @Column({ name: 'container_number', nullable: true })
  containerNumber?: string;

  @ManyToOne(() => Trip, (trip) => trip.tripContainers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip?: Trip;
}
