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
import { FleetBrand } from './fleet-brand.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'fleet_brand_versions' })
export class FleetBrandVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'brand_id', type: 'int' })
  brandId: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'name_normalized', type: 'text' })
  nameNormalized: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => FleetBrand, (brand) => brand.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand?: FleetBrand;
}
