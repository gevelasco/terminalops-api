import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from 'src/clients/entities/client.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { DestinationRate } from 'src/destination-rates/entities/destination-rate.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'client_delivery' })
export class ClientDelivery {
  @PrimaryColumn({ name: 'client_id', type: 'int' })
  clientId: number;

  @Column({ name: 'postal_code', nullable: true, length: 5 })
  postalCode?: string;

  @Column({ name: 'city_municipality', nullable: true })
  cityMunicipality?: string;

  @Column({ nullable: true })
  locality?: string;

  @Column({ name: 'settlement_cons_id', nullable: true, length: 32 })
  settlementConsId?: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitude?: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitude?: string;

  @Column({ name: 'destination_rate_id', type: 'int', nullable: true })
  destinationRateId?: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => DestinationRate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'destination_rate_id' })
  destinationRate?: DestinationRate;

  @OneToOne(() => Client, (c) => c.delivery, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;
}
