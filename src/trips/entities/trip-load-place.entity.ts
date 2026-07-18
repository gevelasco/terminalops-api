import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';

/** Catálogo por empresa de lugares de carga capturados en maniobras. */
@Entity({ schema: TERMINALOPS_SCHEMA, name: 'trip_load_places' })
export class TripLoadPlace {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'name_normalized', type: 'text' })
  nameNormalized: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: Company;
}
