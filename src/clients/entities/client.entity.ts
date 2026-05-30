import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClientBilling } from 'src/clients/entities/client-billing.entity';
import { ClientContact } from 'src/clients/entities/client-contact.entity';
import { ClientDelivery } from 'src/clients/entities/client-delivery.entity';
import { ClientPaymentTerms } from 'src/clients/entities/client-payment-terms.entity';
import { Company } from 'src/companies/entities/company.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'clients' })
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  rfc?: string;

  @Column({ name: 'relationship_started_on', type: 'date', nullable: true })
  relationshipStartedOn?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => ClientBilling, (b) => b.client)
  billing?: ClientBilling;

  @OneToOne(() => ClientPaymentTerms, (p) => p.client)
  paymentTerms?: ClientPaymentTerms;

  @OneToOne(() => ClientDelivery, (d) => d.client)
  delivery?: ClientDelivery;

  @OneToMany(() => ClientContact, (c) => c.client)
  contacts?: ClientContact[];

  @OneToMany(() => Trip, (trip) => trip.client)
  trips?: Trip[];

  /** Conteo de maniobras (solo en listados; no es columna persistida). */
  maneuverCount?: number;

  @ManyToOne(() => Company, (c) => c.clients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: Company;
}
