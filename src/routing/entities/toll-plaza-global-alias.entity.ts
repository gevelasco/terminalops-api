import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'toll_plaza_global_aliases' })
export class TollPlazaGlobalAlias {
  @PrimaryColumn({ name: 'plaza_key', type: 'varchar', length: 128 })
  plazaKey: string;

  @Column({ name: 'display_name', type: 'varchar', length: 200 })
  displayName: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}