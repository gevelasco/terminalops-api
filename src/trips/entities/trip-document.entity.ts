import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Trip } from 'src/trips/entities/trip.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'trip_documents' })
export class TripDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'trip_id', type: 'int' })
  tripId: number;

  @Column({ name: 'document_kind' })
  documentKind: string;

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

  @ManyToOne(() => Trip, (t) => t.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip?: Trip;
}
