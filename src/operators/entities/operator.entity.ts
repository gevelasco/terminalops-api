import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { OperatorDocument } from 'src/operators/entities/operator-document.entity';
import { OperatorEmergencyContact } from 'src/operators/entities/operator-emergency-contact.entity';
import { OperatorPrivateInsurance } from 'src/operators/entities/operator-private-insurance.entity';
import { OperatorPublicInsurance } from 'src/operators/entities/operator-public-insurance.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'operators' })
export class Operator {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column()
  name: string;

  @Column({ name: 'portal_username', unique: true, nullable: true })
  portalUsername?: string;

  @Column({ name: 'photo_data_url', type: 'text', nullable: true })
  photoDataUrl?: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate?: string;

  @Column({ nullable: true })
  curp?: string;

  @Column({ nullable: true })
  rfc?: string;

  @Column({ name: 'license_number', nullable: true })
  licenseNumber?: string;

  @Column({ name: 'license_expires_on', type: 'date', nullable: true })
  licenseExpiresOn?: string;

  @Column({ name: 'license_type', default: 'unspecified' })
  licenseType: string;

  @Column({ name: 'license_endorsements', nullable: true })
  licenseEndorsements?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ name: 'phone_secondary', nullable: true })
  phoneSecondary?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ name: 'company_hire_date', type: 'date', nullable: true })
  companyHireDate?: string;

  @Column({ name: 'employment_contract_type', nullable: true })
  employmentContractType?: string;

  @Column({ default: 'available' })
  status: string;

  @Column({ name: 'insurance_kind', default: 'none' })
  insuranceKind: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => OperatorEmergencyContact, (c) => c.operator)
  emergencyContact?: OperatorEmergencyContact;

  @OneToOne(() => OperatorPublicInsurance, (i) => i.operator)
  publicInsurance?: OperatorPublicInsurance;

  @OneToOne(() => OperatorPrivateInsurance, (i) => i.operator)
  privateInsurance?: OperatorPrivateInsurance;

  @OneToMany(() => OperatorDocument, (d) => d.operator)
  documents?: OperatorDocument[];
}
