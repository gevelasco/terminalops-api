import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Unit } from 'src/units/entities/unit.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'fleet_asset_tenure' })
export class FleetAssetTenure {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ name: 'unit_id', type: 'int', nullable: true })
  unitId?: number | null;

  @Column({ name: 'equipment_id', type: 'int', nullable: true })
  equipmentId?: number | null;

  @Column({ name: 'tenure_mode', type: 'text', nullable: true })
  tenureMode?: string;

  @Column({
    name: 'commercial_value',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  commercialValue?: string;

  @Column({
    name: 'recurring_payment_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  recurringPaymentAmount?: string;

  @Column({ name: 'recurring_payment_date', type: 'date', nullable: true })
  recurringPaymentDate?: string;

  @Column({ name: 'recurring_installment_count', type: 'int', nullable: true })
  recurringInstallmentCount?: number;

  @Column({ name: 'recurring_payment_cadence', nullable: true })
  recurringPaymentCadence?: string;

  @Column({ name: 'recurring_last_payment_date', type: 'date', nullable: true })
  recurringLastPaymentDate?: string | null;

  @Column({ name: 'tenure_beneficiary', type: 'text', nullable: true })
  tenureBeneficiary?: string | null;

  @Column({
    name: 'management_owner_payout',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  managementOwnerPayout?: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Unit, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @ManyToOne(() => Equipment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'equipment_id' })
  equipment?: Equipment;
}
