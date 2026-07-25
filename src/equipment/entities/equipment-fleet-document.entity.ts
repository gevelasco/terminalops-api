import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Equipment } from 'src/equipment/entities/equipment.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'equipment_fleet_documents' })
export class EquipmentFleetDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'equipment_id', type: 'int' })
  equipmentId: number;

  @Column({ name: 'document_kind' })
  documentKind: string;

  @Column({ name: 'file_name' })
  fileName: string;

  /** S3 object key (`folder/uuid.ext`). Null for legacy name-only rows. */
  @Column({ name: 'storage_key', type: 'text', nullable: true })
  storageKey: string | null;

  @Column({ name: 'content_type', type: 'text', nullable: true })
  contentType: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes: string | null;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Equipment, (e) => e.fleetDocuments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment?: Equipment;
}
