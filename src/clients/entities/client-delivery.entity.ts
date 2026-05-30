import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from 'src/clients/entities/client.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';

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

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Client, (c) => c.delivery, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;
}
