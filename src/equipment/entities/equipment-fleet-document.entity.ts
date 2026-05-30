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

  @ManyToOne(() => Equipment, (e) => e.fleetDocuments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment?: Equipment;
}
