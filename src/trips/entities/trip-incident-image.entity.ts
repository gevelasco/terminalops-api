import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'trip_incident_images' })
export class TripIncidentImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'trip_incident_id', type: 'int' })
  tripIncidentId: number;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'storage_key', type: 'text', nullable: true })
  storageKey: string | null;

  @Column({ name: 'content_type', type: 'text', nullable: true })
  contentType: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes: string | null;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @ManyToOne(() => TripIncident, (incident) => incident.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trip_incident_id' })
  incident?: TripIncident;
}
