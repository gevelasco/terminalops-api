import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from 'src/clients/entities/client.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'client_contacts' })
export class ClientContact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'client_id', type: 'int' })
  clientId: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  role?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Client, (c) => c.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;
}
