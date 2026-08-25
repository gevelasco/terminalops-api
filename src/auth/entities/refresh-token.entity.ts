import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { AppUser } from 'src/users/entities/app-user.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'refresh_tokens' })
@Index('refresh_tokens_user_id_idx', ['userId'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Index('refresh_tokens_jti_uidx', { unique: true })
  @Column({ type: 'uuid' })
  jti: string;

  @Index('refresh_tokens_token_hash_uidx', { unique: true })
  @Column({ name: 'token_hash', type: 'text' })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'replaced_by_jti', type: 'uuid', nullable: true })
  replacedByJti?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: AppUser;
}
