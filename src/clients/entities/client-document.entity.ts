import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Client } from 'src/clients/entities/client.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'client_documents' })
export class ClientDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'client_id', type: 'int' })
  clientId: number;

  @Column({ name: 'file_name' })
  fileName: string;

  /** Hoy solo `fiscal` (datos fiscales / facturación). */
  @Column()
  slot: string;

  /** S3 object key (`folder/uuid.ext`). Null for legacy name-only rows. */
  @Column({ name: 'storage_key', type: 'text', nullable: true })
  storageKey: string | null;

  @Column({ name: 'content_type', type: 'text', nullable: true })
  contentType: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes: string | null;

  @Column({ name: 'added_at', type: 'date' })
  addedAt: string;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Client, (c) => c.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client?: Client;
}
