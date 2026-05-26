import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare } from 'bcrypt';
import { FindOptionsWhere, Repository } from 'typeorm';
import { hashPassword } from '../auth/auth.utils';
import { AppUser } from 'src/users/entities/app-user.entity';
import { UserPreferences } from 'src/users/entities/user-preferences.entity';
import AuthUser, { ThemeScheme } from '../types/auth-user.type';
import { toIsoString } from '../common/utils/iso-date.util';
import { ConfigService } from '@nestjs/config';
import EnvConfig from '../types/env-config.type';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

const ROLE_JOB_TITLES: Record<string, string> = {
  superadmin: 'Super administrador',
  admin: 'Administrador',
  coordinator: 'Coordinador de operaciones',
  operator: 'Operador',
  viewer: 'Consulta',
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(AppUser)
    private readonly usersRepo: Repository<AppUser>,
    @InjectRepository(UserPreferences)
    private readonly preferencesRepo: Repository<UserPreferences>,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  findOne(where: FindOptionsWhere<AppUser>) {
    return this.usersRepo.findOne({
      where,
      relations: ['company', 'preferences'],
    });
  }

  findByPublicId(publicId: number) {
    return this.usersRepo.findOne({
      where: { publicId },
      relations: ['company', 'preferences'],
    });
  }

  async getProfileByPublicId(publicId: number) {
    const user = await this.findByPublicId(publicId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.toProfileResponse(user);
  }

  toProfileResponse(user: AppUser) {
    const theme = this.resolveTheme(user.preferences?.themeScheme);
    const department =
      user.role === 'admin' || user.role === 'superadmin' ? 'Gerencia' : '';
    return {
      id: user.publicId,
      username: user.username,
      displayName: user.displayName ?? user.username,
      email: user.email ?? '',
      phone: user.phone ?? '',
      jobTitle:
        user.jobTitle?.trim() ||
        ROLE_JOB_TITLES[user.role] ||
        ROLE_JOB_TITLES.coordinator,
      photoDataUrl: user.photoDataUrl ?? '',
      theme,
      role: user.role,
      memberSince: toIsoString(user.createdAt),
      department,
      workLocation: user.company?.name ?? '',
      employeeId: String(user.publicId),
    };
  }

  async updateProfile(publicId: number, dto: UpdateUserProfileDto) {
    const user = await this.findByPublicId(publicId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const nextUsername = dto.username?.trim().toLowerCase();
    const nextEmail = dto.email?.trim().toLowerCase();

    if (nextUsername && nextUsername !== user.username.trim().toLowerCase()) {
      const conflict = await this.findUpdateConflict(
        user.id,
        nextUsername,
        nextEmail ?? user.email ?? '',
      );
      if (conflict === 'username') {
        throw new ConflictException('El nombre de usuario ya está registrado.');
      }
      user.username = nextUsername;
    }

    if (nextEmail && nextEmail !== (user.email?.trim().toLowerCase() ?? '')) {
      const conflict = await this.findUpdateConflict(
        user.id,
        nextUsername ?? user.username,
        nextEmail,
      );
      if (conflict === 'email') {
        throw new ConflictException('El correo electrónico ya está registrado.');
      }
      user.email = nextEmail;
    }

    if (dto.displayName !== undefined) {
      user.displayName = dto.displayName.trim();
    }
    if (dto.phone !== undefined) {
      user.phone = dto.phone.trim();
    }
    if (dto.jobTitle !== undefined) {
      user.jobTitle = dto.jobTitle.trim();
    }
    if (dto.photoDataUrl !== undefined) {
      user.photoDataUrl = dto.photoDataUrl.trim();
    }

    await this.usersRepo.save(user);

    if (dto.theme) {
      await this.updateTheme(user.id, dto.theme);
    }

    const fresh = await this.findOne({ id: user.id });
    if (!fresh) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return fresh;
  }

  async updatePassword(
    publicId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.public_id = :publicId', { publicId })
      .getOne();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const valid = await compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }

    user.passwordHash = await hashPassword(newPassword, this.saltRounds);
    await this.usersRepo.save(user);
  }

  async findUpdateConflict(
    userId: string,
    username: string,
    email: string,
  ): Promise<'username' | 'email' | null> {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.usersRepo
      .createQueryBuilder('user')
      .where('user.id <> :userId', { userId })
      .andWhere(
        `(LOWER(user.username) IN (:username, :email)
          OR LOWER(COALESCE(user.email, '')) IN (:username, :email))`,
        { username: normalizedUsername, email: normalizedEmail },
      )
      .getMany();

    if (existing.length === 0) {
      return null;
    }

    if (
      existing.some(
        (row) => row.username.trim().toLowerCase() === normalizedUsername,
      )
    ) {
      return 'username';
    }
    if (
      existing.some(
        (row) => row.email?.trim().toLowerCase() === normalizedEmail,
      )
    ) {
      return 'email';
    }
    return 'username';
  }

  findByLogin(login: string) {
    const normalized = login.trim().toLowerCase();
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('user.preferences', 'preferences')
      .where('LOWER(user.username) = :login OR LOWER(user.email) = :login', {
        login: normalized,
      })
      .getOne();
  }

  async findSignUpConflict(
    username: string,
    email: string,
  ): Promise<'username' | 'email' | null> {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.usersRepo
      .createQueryBuilder('user')
      .where(
        `LOWER(user.username) IN (:username, :email)
         OR LOWER(COALESCE(user.email, '')) IN (:username, :email)`,
        {
          username: normalizedUsername,
          email: normalizedEmail,
        },
      )
      .getMany();

    if (existing.length === 0) {
      return null;
    }

    const usernameTaken = existing.some(
      (row) => row.username.trim().toLowerCase() === normalizedUsername,
    );
    const emailTaken = existing.some(
      (row) => row.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (usernameTaken) {
      return 'username';
    }
    if (emailTaken) {
      return 'email';
    }
    // El usuario o correo coincide con credencial de otro tenant (login global).
    return 'username';
  }

  generateAuthUser(user: AppUser): AuthUser {
    const theme = this.resolveTheme(user.preferences?.themeScheme);
    const { firstName, lastName } = this.splitDisplayName(user.displayName);
    const department =
      user.role === 'admin' || user.role === 'superadmin' ? 'Gerencia' : '';
    return {
      id: String(user.publicId),
      name: user.displayName ?? user.username,
      firstName,
      lastName,
      email: user.email ?? '',
      username: user.username,
      phone: user.phone ?? '',
      jobTitle:
        user.jobTitle?.trim() ||
        ROLE_JOB_TITLES[user.role] ||
        ROLE_JOB_TITLES.coordinator,
      photoDataUrl: user.photoDataUrl ?? '',
      role: user.role as AuthUser['role'],
      companyId: String(user.company?.publicId ?? ''),
      companyName: user.company?.name,
      theme,
      memberSince: toIsoString(user.createdAt),
      department,
      workLocation: user.company?.name ?? '',
      employeeId: String(user.publicId),
      operationalAnalysisEnabled:
        user.company?.operationalAnalysisEnabled ?? true,
      operationalAnalysisChangedAt: toIsoString(
        user.company?.operationalAnalysisChangedAt,
      ),
      maintenanceKmControlEnabled:
        user.company?.maintenanceKmControlEnabled ?? false,
      maintenanceKmIntervalDefault: (() => {
        const raw = user.company?.maintenanceKmIntervalDefault;
        if (raw == null || raw === '') {
          return undefined;
        }
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })(),
      maintenanceDateControlEnabled:
        user.company?.maintenanceDateControlEnabled ?? false,
      maintenanceDatePeriodDefault:
        user.company?.maintenanceDatePeriodDefault ?? undefined,
      maintenanceKmControlChangedAt: toIsoString(
        user.company?.maintenanceKmControlChangedAt,
      ),
      maintenanceDateControlChangedAt: toIsoString(
        user.company?.maintenanceDateControlChangedAt,
      ),
      operationalCenterPostalCode:
        user.company?.operationalCenterPostalCode ?? undefined,
      operationalCenterCityMunicipality:
        user.company?.operationalCenterCityMunicipality ?? undefined,
      operationalCenterLocality:
        user.company?.operationalCenterLocality ?? undefined,
      operationalCenterSettlementConsId:
        user.company?.operationalCenterSettlementConsId ?? undefined,
      operationalCenterLatitude: (() => {
        const raw = user.company?.operationalCenterLatitude;
        if (raw == null || raw === '') {
          return undefined;
        }
        const n = Number(raw);
        return Number.isFinite(n) ? n : undefined;
      })(),
      operationalCenterLongitude: (() => {
        const raw = user.company?.operationalCenterLongitude;
        if (raw == null || raw === '') {
          return undefined;
        }
        const n = Number(raw);
        return Number.isFinite(n) ? n : undefined;
      })(),
    };
  }

  async createForCompany(
    companyId: string,
    data: {
      username: string;
      password: string;
      displayName?: string;
      email?: string;
      phone?: string;
      role?: string;
      theme?: ThemeScheme;
    },
  ) {
    const passwordHash = await hashPassword(data.password, this.saltRounds);
    const role = data.role ?? 'admin';
    const user = await this.usersRepo.save(
      this.usersRepo.create({
        companyId,
        username: data.username.trim(),
        displayName: data.displayName?.trim() ?? data.username.trim(),
        email: data.email?.trim().toLowerCase(),
        phone: data.phone?.trim(),
        jobTitle: ROLE_JOB_TITLES[role] ?? ROLE_JOB_TITLES.coordinator,
        passwordHash,
        role,
        status: 'active',
      }),
    );
    await this.createPreferences(user.id, data.theme ?? 'light');
    const full = await this.findOne({ id: user.id });
    if (!full) {
      throw new NotFoundException('User not found after creation');
    }
    return full;
  }

  async createPreferences(userId: string, theme: ThemeScheme = 'light') {
    return this.preferencesRepo.save(
      this.preferencesRepo.create({
        userId,
        themeScheme: theme,
        operationalAnalysisEnabled: true,
      }),
    );
  }

  async updateTheme(userId: string, theme: ThemeScheme) {
    await this.preferencesRepo.update({ userId }, { themeScheme: theme });
  }

  private resolveTheme(value?: string): ThemeScheme {
    return value === 'dark' ? 'dark' : 'light';
  }

  private splitDisplayName(displayName?: string): {
    firstName?: string;
    lastName?: string;
  } {
    if (!displayName?.trim()) {
      return {};
    }
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0] };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private get saltRounds(): number {
    return Number(this.config.get('SALT_ROUNDS', { infer: true }) ?? 10);
  }
}
