import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'trip_attached_documents' })
export class TripAttachedDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'trip_id', type: 'int' })
  tripId: number;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;
}
