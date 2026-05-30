import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { UserPreferences } from 'src/users/entities/user-preferences.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'app_user' })
export class AppUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column()
  username: string;

  @Column({ name: 'display_name', nullable: true })
  displayName?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ name: 'job_title', nullable: true })
  jobTitle?: string;

  @Column({ name: 'photo_data_url', type: 'text', nullable: true })
  photoDataUrl?: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ default: 'coordinator' })
  role: string;

  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Company, (c) => c.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @OneToOne(() => UserPreferences, (prefs) => prefs.user)
  preferences?: UserPreferences;
}
