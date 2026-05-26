import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'equipment_fleet_documents' })
export class EquipmentFleetDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'equipment_id', type: 'uuid' })
  equipmentId: string;

  @Column({ name: 'document_kind' })
  documentKind: string;

  @Column({ name: 'file_name' })
  fileName: string;
}
