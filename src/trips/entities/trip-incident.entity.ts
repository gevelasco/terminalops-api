import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Trip } from 'src/trips/entities/trip.entity';

/** Entrada de bitácora de maniobra; `isIncident` marca el subconjunto operativo. */
@Entity({ schema: TERMINALOPS_SCHEMA, name: 'trip_incidents' })
export class TripIncident {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'trip_id', type: 'int' })
  tripId: number;

  @Column()
  description: string;

  @Column({ name: 'posted_by' })
  postedBy: string;

  @Column({ name: 'is_incident', default: false })
  isIncident: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Trip, (t) => t.incidents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;
}
