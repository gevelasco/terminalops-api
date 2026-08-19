import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Expense } from 'src/expenses/entities/expense.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'expense_documents' })
export class ExpenseDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'expense_id', type: 'int' })
  expenseId: number;

  @Column({ name: 'file_name' })
  fileName: string;

  /** Hoy solo `receipt` (comprobante / factura del gasto). */
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

  @ManyToOne(() => Expense, (e) => e.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expense_id' })
  expense?: Expense;
}
