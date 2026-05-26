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

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'client_payment_terms' })
export class ClientPaymentTerms {
  @PrimaryColumn({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @Column({ name: 'has_credit', default: false })
  hasCredit: boolean;

  @Column({ name: 'credit_days', type: 'int', nullable: true })
  creditDays?: number;

  @Column({ name: 'approximate_credit_amount', nullable: true })
  approximateCreditAmount?: string;

  @Column({ name: 'commercial_health', default: 'not_evaluated' })
  commercialHealth: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Client, (c) => c.paymentTerms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;
}
