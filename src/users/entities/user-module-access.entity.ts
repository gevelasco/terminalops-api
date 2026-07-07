import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { AppUser } from 'src/users/entities/app-user.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'user_module_access' })
export class UserModuleAccess {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId: number;

  @PrimaryColumn({ name: 'module_code', type: 'text' })
  moduleCode: string;

  @Column({ name: 'access_level', type: 'text', default: 'write' })
  accessLevel: 'read' | 'write';

  @ManyToOne(() => AppUser, (user) => user.moduleAccess, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: AppUser;
}
