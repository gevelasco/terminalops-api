import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { DestinationRatePrice } from 'src/destination-rates/entities/destination-rate-price.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'company_operation_configurations' })
export class CompanyOperationConfiguration {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'max_equipment_count', type: 'smallint', default: 1 })
  maxEquipmentCount: number;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => DestinationRatePrice, (price) => price.operationConfiguration)
  destinationRatePrices?: DestinationRatePrice[];
}
