import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { CompanyOperationConfiguration } from 'src/operation-configurations/entities/company-operation-configuration.entity';
import { DestinationRate } from './destination-rate.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'destination_rate_prices' })
export class DestinationRatePrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'destination_rate_id', type: 'int' })
  destinationRateId: number;

  @Column({ name: 'operation_configuration_id', type: 'int' })
  operationConfigurationId: number;

  @Column({ name: 'client_charge', type: 'numeric', precision: 12, scale: 2, default: 0 })
  clientCharge: string;

  @Column({
    name: 'operator_payment_estimate',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  operatorPaymentEstimate: string;

  @Column({
    name: 'estimated_toll_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  estimatedTollAmount: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => DestinationRate, (rate) => rate.prices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_rate_id' })
  destinationRate?: DestinationRate;

  @ManyToOne(() => CompanyOperationConfiguration, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'operation_configuration_id' })
  operationConfiguration?: CompanyOperationConfiguration;
}
