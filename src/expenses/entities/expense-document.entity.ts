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

  @Column({ name: 'added_at', type: 'date' })
  addedAt: string;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Expense, (e) => e.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expense_id' })
  expense?: Expense;
}
