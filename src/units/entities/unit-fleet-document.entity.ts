import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Unit } from 'src/units/entities/unit.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'unit_fleet_documents' })
export class UnitFleetDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'unit_id', type: 'int' })
  unitId: number;

  @Column({ name: 'document_kind' })
  documentKind: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Unit, (u) => u.fleetDocuments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;
}
