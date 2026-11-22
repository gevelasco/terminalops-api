import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { AppUser } from 'src/users/entities/app-user.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'user_preferences' })
export class UserPreferences {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'theme_scheme', default: 'light' })
  themeScheme: string;

  /** null = todas las notificaciones de módulos permitidos (RBAC). */
  @Column({ name: 'notification_feed_modules', type: 'jsonb', nullable: true })
  notificationFeedModules?: string[] | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => AppUser, (user) => user.preferences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: AppUser;
}
