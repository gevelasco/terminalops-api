import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import type {
  InvitationGrantedPlan,
  InvitationPurpose,
} from 'src/common/constants/invitation-codes';
import { AppUser } from 'src/users/entities/app-user.entity';
import { Company } from 'src/companies/entities/company.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'invitation_codes' })
export class InvitationCode {
  @PrimaryGeneratedColumn()
  id: number;

  /** Código normalizado (mayúsculas). */
  @Index('invitation_codes_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code: string;

  /** signup = registro; upgrade = canje desde Cuenta. */
  @Column({ type: 'text' })
  purpose: InvitationPurpose;

  /** Plan que otorga el código al canjearse. */
  @Column({ name: 'granted_plan', type: 'text' })
  grantedPlan: InvitationGrantedPlan;

  /** Meses de licencia desde el canje. */
  @Column({ name: 'license_months', type: 'int' })
  licenseMonths: number;

  @Column({ name: 'max_uses', type: 'int', default: 1 })
  maxUses: number;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Column({ name: 'redeemed_at', type: 'timestamptz', nullable: true })
  redeemedAt?: Date | null;

  @Column({ name: 'redeemed_by_user_id', type: 'int', nullable: true })
  redeemedByUserId?: number | null;

  @Column({ name: 'redeemed_by_company_id', type: 'int', nullable: true })
  redeemedByCompanyId?: number | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => AppUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'redeemed_by_user_id' })
  redeemedByUser?: AppUser | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'redeemed_by_company_id' })
  redeemedByCompany?: Company | null;
}
