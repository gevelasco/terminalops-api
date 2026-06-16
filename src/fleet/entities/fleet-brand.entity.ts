import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { FleetBrandVersion } from './fleet-brand-version.entity';

export type FleetBrandType = 'UNIT' | 'EQUIPMENT';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'fleet_brands' })
export class FleetBrand {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ type: 'text' })
  type: FleetBrandType;

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

  @OneToMany(() => FleetBrandVersion, (version) => version.brand)
  versions?: FleetBrandVersion[];
}
