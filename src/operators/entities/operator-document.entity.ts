import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Operator } from 'src/operators/entities/operator.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'operator_documents' })
export class OperatorDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'public_id', type: 'int', unique: true })
  publicId: number;

  @Column({ name: 'operator_id', type: 'uuid' })
  operatorId: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column()
  slot: string;

  @Column({ name: 'added_at', type: 'date' })
  addedAt: string;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Operator, (o) => o.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operator_id' })
  operator: Operator;
}
