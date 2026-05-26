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

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'client_billing' })
export class ClientBilling {
  @PrimaryColumn({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @Column({ name: 'invoice_legal_name', nullable: true })
  invoiceLegalName?: string;

  @Column({ name: 'tax_regime', nullable: true })
  taxRegime?: string;

  @Column({ name: 'fiscal_zip', nullable: true })
  fiscalZip?: string;

  @Column({ name: 'cfdi_use', nullable: true })
  cfdiUse?: string;

  @Column({ name: 'billing_email', nullable: true })
  billingEmail?: string;

  @Column({ name: 'billing_phone', nullable: true })
  billingPhone?: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Client, (c) => c.billing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;
}
