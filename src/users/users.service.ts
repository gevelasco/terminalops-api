import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { UserModuleAccess } from 'src/users/entities/user-module-access.entity';
import AuthUser, { ThemeScheme } from '../types/auth-user.type';
import { toIsoString } from '../common/utils/iso-date.util';
import { ConfigService } from '@nestjs/config';
import EnvConfig from '../types/env-config.type';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { operationalCenterGeoForApi } from 'src/operational-centers/operational-center-geo-for-api';
import {
  canManageUsers,
  canViewAccount,
  moduleCodesFromStaffGrants,
  resolveAllowedModules,
  type StaffGrantableModuleCode,
  type StaffModuleGrant,
} from 'src/common/constants/app-modules';
import {
  mergeModuleGrantInput,
  normalizeStaffModuleGrantsFromRows,
} from 'src/common/utils/module-permission.util';

const ROLE_JOB_TITLES: Record<string, string> = {
  superadmin: 'Propietario',
  admin: 'Administrador',
  staff: 'Staff',
  coordinator: 'Staff',
  operator: 'Staff',
  viewer: 'Staff',
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(AppUser)
    private readonly usersRepo: Repository<AppUser>,
    @InjectRepository(UserPreferences)
    private readonly preferencesRepo: Repository<UserPreferences>,
    @InjectRepository(UserModuleAccess)
    private readonly moduleAccessRepo: Repository<UserModuleAccess>,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  findOne(where: FindOptionsWhere<AppUser>) {
    return this.usersRepo.findOne({
      where,
      relations: ['company', 'company.primaryOperationalCenter', 'preferences', 'moduleAccess'],
    });
  }

  findById(id: number) {
    return this.usersRepo.findOne({
      where: { id },
      relations: ['company', 'company.primaryOperationalCenter', 'preferences', 'moduleAccess'],
    });
  }

  async getProfileById(id: number) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.toProfileResponse(user);
  }

  toProfileResponse(user: AppUser) {
    const theme = this.resolveTheme(user.preferences?.themeScheme);
    const department = this.resolveUserDepartment(user.role);
    const workLocation = this.resolveUserWorkLocation(user);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName ?? user.username,
      email: user.email ?? '',
      phone: user.phone ?? '',
      jobTitle: this.resolveUserJobTitle(user),
      photoDataUrl: user.photoDataUrl ?? '',
      theme,
      role: user.role,
      memberSince: toIsoString(user.createdAt),
      department,
      workLocation,
      employeeId: String(user.id),
      controlAutomaticRecognition:
        user.preferences?.controlAutomaticRecognition ?? false,
      controlAutomaticRecognitionChangedAt: toIsoString(
        user.preferences?.controlAutomaticRecognitionChangedAt,
      ),
    };
  }

  async updateProfile(id: number, dto: UpdateUserProfileDto) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const nextUsername = dto.username?.trim().toLowerCase();
    const nextEmail = dto.email?.trim().toLowerCase();

    if (nextUsername && nextUsername !== user.username.trim().toLowerCase()) {
      if (await this.isUsernameTakenInCompany(user.companyId, nextUsername, user.id)) {
        throw new ConflictException(
          'El nombre de usuario ya está registrado en esta empresa.',
        );
      }
      user.username = nextUsername;
    }

    if (nextEmail && nextEmail !== (user.email?.trim().toLowerCase() ?? '')) {
      if (await this.isEmailTaken(nextEmail, user.id)) {
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

    if (dto.controlAutomaticRecognition !== undefined) {
      await this.updateControlAutomaticRecognition(
        user.id,
        dto.controlAutomaticRecognition,
      );
    }

    const fresh = await this.findOne({ id: user.id });
    if (!fresh) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return fresh;
  }

  async updatePassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
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

  /** Correo único en toda la app (cualquier empresa). */
  async isEmailTaken(email: string, excludeUserId?: number): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    const qb = this.usersRepo
      .createQueryBuilder('user')
      .where('LOWER(btrim(user.email)) = :email', { email: normalized });
    if (excludeUserId != null) {
      qb.andWhere('user.id <> :excludeUserId', { excludeUserId });
    }
    return (await qb.getCount()) > 0;
  }

  /** Username único solo dentro de la misma empresa. */
  async isUsernameTakenInCompany(
    companyId: number,
    username: string,
    excludeUserId?: number,
  ): Promise<boolean> {
    const normalized = username.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    const qb = this.usersRepo
      .createQueryBuilder('user')
      .where('user.companyId = :companyId', { companyId })
      .andWhere('LOWER(btrim(user.username)) = :username', {
        username: normalized,
      });
    if (excludeUserId != null) {
      qb.andWhere('user.id <> :excludeUserId', { excludeUserId });
    }
    return (await qb.getCount()) > 0;
  }

  findByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('company.primaryOperationalCenter', 'primaryOperationalCenter')
      .leftJoinAndSelect('user.preferences', 'preferences')
      .leftJoinAndSelect('user.moduleAccess', 'moduleAccess')
      .where('LOWER(btrim(user.email)) = :email', { email: normalized })
      .getOne();
  }

  generateAuthUser(user: AppUser): AuthUser {
    const moduleGrants = normalizeStaffModuleGrantsFromRows(user.moduleAccess ?? []);
    const allowedModules = resolveAllowedModules(user.role, moduleGrants);
    const theme = this.resolveTheme(user.preferences?.themeScheme);
    const { firstName, lastName } = this.splitDisplayName(user.displayName);
    const department = this.resolveUserDepartment(user.role);
    const workLocation = this.resolveUserWorkLocation(user);
    return {
      id: String(user.id),
      name: user.displayName ?? user.username,
      firstName,
      lastName,
      email: user.email ?? '',
      username: user.username,
      phone: user.phone ?? '',
      jobTitle: this.resolveUserJobTitle(user),
      photoDataUrl: user.photoDataUrl ?? '',
      role: user.role as AuthUser['role'],
      allowedModules,
      moduleGrants,
      companyId: String(user.companyId),
      companyName: user.company?.name,
      theme,
      memberSince: toIsoString(user.createdAt),
      department,
      workLocation,
      employeeId: String(user.id),
      operationalAnalysisEnabled:
        user.company?.operationalAnalysisEnabled ?? true,
      operationalAnalysisChangedAt: toIsoString(
        user.company?.operationalAnalysisChangedAt,
      ),
      tripAssistPrefillEnabled:
        user.company?.tripAssistPrefillEnabled ??
        user.preferences?.controlAutomaticRecognition ??
        false,
      tripAssistPrefillChangedAt: toIsoString(
        user.company?.tripAssistPrefillChangedAt ??
          user.preferences?.controlAutomaticRecognitionChangedAt,
      ),
      tripAutoMaintenanceProvisionPercent: (() => {
        const raw = user.company?.tripAutoMaintenanceProvisionPercent;
        if (raw == null || raw === '') {
          return 5;
        }
        const n = Number(raw);
        return Number.isFinite(n) && n >= 0 ? n : 5;
      })(),
      tripAutoFuelPaymentMethod:
        user.company?.tripAutoFuelPaymentMethod ?? 'cash',
      tripAutoTollsPaymentMethod:
        user.company?.tripAutoTollsPaymentMethod ?? 'cash',
      tripAutoPerDiemPaymentMethod:
        user.company?.tripAutoPerDiemPaymentMethod ?? 'cash',
      tripAutoControlPaymentMethod:
        user.company?.tripAutoControlPaymentMethod ?? 'cash',
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
      dieselControlEnabled: user.company?.dieselControlEnabled ?? true,
      dieselControlChangedAt: toIsoString(user.company?.dieselControlChangedAt),
      controlAutomaticRecognition:
        user.company?.tripAssistPrefillEnabled ??
        user.preferences?.controlAutomaticRecognition ??
        false,
      controlAutomaticRecognitionChangedAt: toIsoString(
        user.company?.tripAssistPrefillChangedAt ??
          user.preferences?.controlAutomaticRecognitionChangedAt,
      ),
      ...(() => {
        const primary = user.company?.primaryOperationalCenter;
        const geo = operationalCenterGeoForApi(primary);
        return {
          operationalCenterId:
            primary?.id != null ? String(primary.id) : undefined,
          operationalCenterName: geo.operationalCenterName,
          operationalCenterPostalCode: geo.operationalCenterPostalCode,
          operationalCenterCityMunicipality: geo.operationalCenterCityMunicipality,
          operationalCenterLocality: geo.operationalCenterLocality,
          operationalCenterSettlementConsId: geo.operationalCenterSettlementConsId,
          operationalCenterLatitude: geo.operationalCenterLatitude,
          operationalCenterLongitude: geo.operationalCenterLongitude,
        };
      })(),
    };
  }

  async createForCompany(
    companyId: number,
    data: {
      username: string;
      password: string;
      displayName?: string;
      email?: string;
      phone?: string;
      jobTitle?: string;
      photoDataUrl?: string;
      role?: string;
      theme?: ThemeScheme;
    },
  ) {
    const username = data.username.trim();
    const email = data.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('El correo electrónico es obligatorio.');
    }
    if (await this.isEmailTaken(email)) {
      throw new ConflictException(
        `El correo "${email}" ya está registrado. Usa otro correo.`,
      );
    }
    if (await this.isUsernameTakenInCompany(companyId, username)) {
      throw new ConflictException(
        `El usuario "${username}" ya existe en esta empresa.`,
      );
    }

    const passwordHash = await hashPassword(data.password, this.saltRounds);
    const role = data.role ?? 'staff';
    const user = await this.usersRepo.save(
      this.usersRepo.create({
        companyId,
        username,
        displayName: data.displayName?.trim() ?? username,
        email,
        phone: data.phone?.trim(),
        jobTitle:
          data.jobTitle?.trim() ||
          ROLE_JOB_TITLES[role] ||
          ROLE_JOB_TITLES.staff,
        photoDataUrl: data.photoDataUrl?.trim() ?? '',
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

  async createPreferences(userId: number, theme: ThemeScheme = 'light') {
    return this.preferencesRepo.save(
      this.preferencesRepo.create({
        userId,
        themeScheme: theme,
        controlAutomaticRecognition: false,
      }),
    );
  }

  async updateTheme(userId: number, theme: ThemeScheme) {
    await this.preferencesRepo.update({ userId }, { themeScheme: theme });
  }

  async updateControlAutomaticRecognition(userId: number, enabled: boolean) {
    let prefs = await this.preferencesRepo.findOne({ where: { userId } });
    if (!prefs) {
      prefs = await this.createPreferences(userId);
    }
    if (prefs.controlAutomaticRecognition !== enabled) {
      prefs.controlAutomaticRecognitionChangedAt = new Date();
    }
    prefs.controlAutomaticRecognition = enabled;
    await this.preferencesRepo.save(prefs);
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

  assertCanManageUsers(actor: AuthUser): void {
    if (!canManageUsers(actor.role)) {
      throw new ForbiddenException('No tienes permiso para administrar usuarios.');
    }
  }

  assertCanViewAccount(actor: AuthUser): void {
    if (!canViewAccount(actor.role)) {
      throw new ForbiddenException('No tienes permiso para ver la cuenta.');
    }
  }

  async listCompanyUsers(companyId: number, actor: AuthUser) {
    this.assertCanManageUsers(actor);
    const users = await this.usersRepo.find({
      where: { companyId },
      relations: ['moduleAccess', 'company', 'company.primaryOperationalCenter'],
      order: { role: 'ASC', username: 'ASC' },
    });
    const visible =
      actor.role === 'superadmin'
        ? users
        : users.filter((user) => user.role !== 'superadmin');
    return visible.map((user) => this.toCompanyUserResponse(user));
  }

  async getCompanyAccount(companyId: number, actor: AuthUser) {
    this.assertCanViewAccount(actor);
    const user = await this.findOne({ id: Number(actor.id) });
    if (!user?.company || user.companyId !== companyId) {
      throw new NotFoundException('Empresa no encontrada');
    }
    const company = user.company;
    const createdAt = toIsoString(company.createdAt) ?? null;

    let subscriptionEndsAt = toIsoString(company.subscriptionEndsAt) ?? null;
    if (!subscriptionEndsAt && company.createdAt) {
      const sixMonths = new Date(company.createdAt);
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      subscriptionEndsAt = sixMonths.toISOString();
    }

    return {
      id: company.id,
      name: company.name,
      tagline: company.tagline ?? null,
      subscriptionStatus: company.subscriptionStatus,
      subscriptionPlan: company.subscriptionPlan ?? 'trial',
      subscriptionEndsAt,
      createdAt,
    };
  }

  async createCompanyUser(
    companyId: number,
    actor: AuthUser,
    data: {
      username: string;
      password: string;
      displayName?: string;
      email: string;
      phone?: string;
      jobTitle?: string;
      photoDataUrl?: string;
      role: 'admin' | 'staff';
      moduleCodes?: StaffGrantableModuleCode[];
      moduleGrants?: StaffModuleGrant[];
    },
  ) {
    this.assertCanManageUsers(actor);
    if (Number(actor.companyId) !== companyId) {
      throw new ForbiddenException('Acceso denegado a esta empresa.');
    }
    if (actor.role !== 'superadmin' && data.role === 'admin') {
      throw new ForbiddenException('Solo el propietario puede crear administradores.');
    }
    const created = await this.createForCompany(companyId, {
      username: data.username,
      password: data.password,
      displayName: data.displayName,
      email: data.email,
      phone: data.phone,
      jobTitle: data.jobTitle,
      photoDataUrl: data.photoDataUrl,
      role: data.role,
    });
    if (data.role === 'staff') {
      await this.replaceModuleAccess(
        created.id,
        mergeModuleGrantInput({
          moduleGrants: data.moduleGrants,
          moduleCodes: data.moduleCodes,
        }),
      );
    }
    const full = await this.findOne({ id: created.id });
    if (!full) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.toCompanyUserResponse(full);
  }

  async updateCompanyUser(
    companyId: number,
    userId: number,
    actor: AuthUser,
    data: {
      displayName?: string;
      username?: string;
      email?: string;
      phone?: string;
      jobTitle?: string;
      photoDataUrl?: string;
      newPassword?: string;
      role?: 'admin' | 'staff';
      status?: 'active' | 'disabled';
      moduleCodes?: StaffGrantableModuleCode[];
      moduleGrants?: StaffModuleGrant[];
    },
  ) {
    this.assertCanManageUsers(actor);
    if (Number(actor.companyId) !== companyId) {
      throw new ForbiddenException('Acceso denegado a esta empresa.');
    }
    const user = await this.usersRepo.findOne({
      where: { id: userId, companyId },
      relations: ['moduleAccess'],
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (user.role === 'superadmin' && actor.role !== 'superadmin') {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (user.role === 'superadmin') {
      throw new ForbiddenException('No puedes modificar al propietario de la cuenta.');
    }
    if (data.role === 'admin' && actor.role !== 'superadmin') {
      throw new ForbiddenException('Solo el propietario puede asignar administradores.');
    }
    if (data.status === 'disabled' && user.id === Number(actor.id)) {
      throw new ForbiddenException('No puedes desactivar tu propia cuenta.');
    }

    const nextUsername = data.username?.trim().toLowerCase();
    const nextEmail = data.email?.trim().toLowerCase();

    if (nextUsername && nextUsername !== user.username.trim().toLowerCase()) {
      if (await this.isUsernameTakenInCompany(companyId, nextUsername, user.id)) {
        throw new ConflictException(
          'El nombre de usuario ya está registrado en esta empresa.',
        );
      }
      user.username = nextUsername;
    }

    if (nextEmail && nextEmail !== (user.email?.trim().toLowerCase() ?? '')) {
      if (await this.isEmailTaken(nextEmail, user.id)) {
        throw new ConflictException('El correo electrónico ya está registrado.');
      }
      user.email = nextEmail;
    }

    if (data.displayName !== undefined) {
      user.displayName = data.displayName.trim();
    }
    if (data.phone !== undefined) {
      user.phone = data.phone.trim();
    }
    if (data.jobTitle !== undefined) {
      user.jobTitle = data.jobTitle.trim();
    }
    if (data.photoDataUrl !== undefined) {
      user.photoDataUrl = data.photoDataUrl.trim();
    }
    if (data.newPassword) {
      user.passwordHash = await hashPassword(
        data.newPassword,
        this.saltRounds,
      );
    }

    if (data.role) {
      user.role = data.role;
      if (data.jobTitle === undefined) {
        user.jobTitle =
          ROLE_JOB_TITLES[data.role] ?? ROLE_JOB_TITLES.staff;
      }
    }
    if (data.status) {
      user.status = data.status;
    }
    await this.usersRepo.save(user);
    if (user.role === 'staff' && (data.moduleGrants || data.moduleCodes)) {
      await this.replaceModuleAccess(
        user.id,
        mergeModuleGrantInput({
          moduleGrants: data.moduleGrants,
          moduleCodes: data.moduleCodes,
        }),
      );
    }
    if (user.role === 'admin') {
      await this.moduleAccessRepo.delete({ userId: user.id });
    }
    const full = await this.findOne({ id: user.id });
    if (!full) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.toCompanyUserResponse(full);
  }

  private async replaceModuleAccess(
    userId: number,
    moduleGrants: StaffModuleGrant[],
  ): Promise<void> {
    await this.moduleAccessRepo.delete({ userId });
    if (moduleGrants.length === 0) {
      return;
    }
    await this.moduleAccessRepo.save(
      moduleGrants.map((grant) =>
        this.moduleAccessRepo.create({
          userId,
          moduleCode: grant.module,
          accessLevel: grant.level,
        }),
      ),
    );
  }

  private toCompanyUserResponse(user: AppUser) {
    const moduleGrants = normalizeStaffModuleGrantsFromRows(user.moduleAccess ?? []);
    const moduleCodes = moduleCodesFromStaffGrants(moduleGrants);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName ?? user.username,
      email: user.email ?? '',
      phone: user.phone ?? '',
      jobTitle: this.resolveUserJobTitle(user),
      photoDataUrl: user.photoDataUrl ?? '',
      department: this.resolveUserDepartment(user.role),
      workLocation: this.resolveUserWorkLocation(user),
      role: user.role,
      status: user.status,
      moduleCodes,
      moduleGrants,
      allowedModules: resolveAllowedModules(user.role, moduleGrants),
      memberSince: toIsoString(user.createdAt),
      employeeId: String(user.id),
    };
  }

  private resolveUserJobTitle(user: AppUser): string {
    return (
      user.jobTitle?.trim() ||
      ROLE_JOB_TITLES[user.role] ||
      ROLE_JOB_TITLES.staff
    );
  }

  private resolveUserDepartment(role: string): string {
    return role === 'admin' || role === 'superadmin' ? 'Gerencia' : 'Operaciones';
  }

  private resolveUserWorkLocation(user: AppUser): string {
    return operationalCenterGeoForApi(user.company?.primaryOperationalCenter)
      .operationalCenterName;
  }
}
