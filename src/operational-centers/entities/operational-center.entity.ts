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
import { DestinationRate } from 'src/destination-rates/entities/destination-rate.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'operational_centers' })
export class OperationalCenter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ default: 'Centro Principal' })
  name: string;

  @Column({ type: 'varchar', length: 32, default: 'MAIN' })
  code: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 5, nullable: true })
  postalCode?: string;

  @Column({ name: 'city_municipality', type: 'text', nullable: true })
  cityMunicipality?: string;

  @Column({ type: 'text', nullable: true })
  locality?: string;

  @Column({ name: 'settlement_cons_id', type: 'varchar', length: 32, nullable: true })
  settlementConsId?: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitude?: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitude?: string;

  @Column({ name: 'is_default', default: true })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @OneToMany(() => DestinationRate, (rate) => rate.originOperationalCenter)
  destinationRates?: DestinationRate[];
}
