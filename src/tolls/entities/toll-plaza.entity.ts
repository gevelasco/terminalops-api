import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';

/**
 * Catálogo propio de casetas MX (tarifas por tipo de unidad).
 * `plaza_id` = ID_PLAZA del dataset casetas/tarifas.
 */
@Entity({ schema: TERMINALOPS_SCHEMA, name: 'toll_plazas' })
export class TollPlaza {
  @PrimaryColumn({ name: 'plaza_id', type: 'int' })
  plazaId: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  section?: string | null;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({
    name: 't_eje_lig',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tEjeLig?: string | null;

  @Column({
    name: 't_autobus2',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tAutobus2?: string | null;

  @Column({
    name: 't_autobus3',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tAutobus3?: string | null;

  @Column({
    name: 't_autobus4',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tAutobus4?: string | null;

  @Column({
    name: 't_camion2',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tCamion2?: string | null;

  @Column({
    name: 't_camion3',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tCamion3?: string | null;

  @Column({
    name: 't_camion4',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tCamion4?: string | null;

  @Column({
    name: 't_camion5',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tCamion5?: string | null;

  @Column({
    name: 't_camion6',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tCamion6?: string | null;

  @Column({
    name: 't_camion7',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tCamion7?: string | null;

  @Column({
    name: 't_camion8',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tCamion8?: string | null;

  @Column({
    name: 't_camion9',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tCamion9?: string | null;

  @Column({
    name: 't_eje_pes',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  tEjePes?: string | null;

  @Column({ name: 'source_year', type: 'smallint', default: 2025 })
  sourceYear: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
