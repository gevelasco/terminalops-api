import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { DestinationRatePrice } from './destination-rate-price.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'destination_rates' })
export class DestinationRate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ name: 'postal_code', type: 'varchar', length: 5 })
  postalCode: string;

  @Column({ name: 'city_municipality', type: 'text', default: '' })
  cityMunicipality: string;

  @Column({ type: 'text', default: '' })
  locality: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => DestinationRatePrice, (price) => price.destinationRate, {
    cascade: true,
  })
  prices?: DestinationRatePrice[];
}
