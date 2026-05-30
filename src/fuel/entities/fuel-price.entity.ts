import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';

export const FUEL_TYPE_DIESEL = 'diesel' as const;

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'fuel_prices' })
export class FuelPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'fuel_type' })
  fuelType: string;

  @Column({ name: 'price_per_liter', type: 'numeric', precision: 10, scale: 4 })
  pricePerLiter: string;

  @Column()
  source: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
